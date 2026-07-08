import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { RecordPaymentForm } from '@/app/(app)/suppliers/record-payment-form'
import { ReceivePaymentForm } from '@/app/(app)/suppliers/receive-payment-form'
import { EditApPaymentForm } from '@/app/(app)/suppliers/edit-ap-payment-form'
import { ExportButton } from '@/components/export-button'
import { PrintButton } from '@/components/print-button'
import { RoleGate } from '@/components/role-gate'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

type Props = { params: Promise<{ id: string }> }

export default async function SupplierLedgerPage({ params }: Props) {
  const { tenantId } = await requireAuth()
  const { id } = await params
  const today = new Date().toISOString().split('T')[0]

  const admin = createAdminClient()

  const { data: supplierRow } = await admin
    .from('suppliers')
    .select('id, name, opening_balance_pkr_equivalent, created_at')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!supplierRow) notFound()

  const [
    { data: rawPurchases },
    { data: rawPayments },
    { data: rawReturns },
    { data: rawDebitNotes },
    { data: rawRefunds },
    { data: rawLots },
  ] = await Promise.all([
    admin.from('purchase_orders')
      .select('id, date, supplier_id, stock_item_id, quantity, rate, currency_code, pkr_equivalent, advance_paid')
      .eq('supplier_id', id).eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('ap_payments')
      .select('id, date, supplier_id, amount, currency_code, pkr_equivalent, payment_method_note')
      .eq('supplier_id', id).eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('purchase_returns')
      .select('id, date, supplier_id, stock_item_id, quantity, rate, currency_code, pkr_equivalent, reason')
      .eq('supplier_id', id).eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('debit_notes')
      .select('id, date, supplier_id, amount, currency_code, pkr_equivalent, reason, reference')
      .eq('supplier_id', id).eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('supplier_refunds')
      .select('id, date, supplier_id, amount, currency_code, pkr_equivalent, payment_method, notes')
      .eq('supplier_id', id).eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
  ])

  const purchases     = rawPurchases  ?? []
  const payments      = rawPayments   ?? []
  const purchaseReturns = rawReturns  ?? []
  const debitNotes    = rawDebitNotes ?? []
  const refunds       = rawRefunds    ?? []
  const lotMap        = new Map((rawLots ?? []).map((l) => [l.id, l.name]))

  type LedgerRow = {
    id: string
    kind: 'opening' | 'purchase' | 'payment' | 'purchase_return' | 'debit_note' | 'supplier_refund'
    date: string
    description: string
    debit: number
    credit: number
    balance: number
    rawPayment?: { id: string; amount: number; currencyCode: string; pkrEquivalent: number; date: string; paymentMethodNote: string | null }
  }

  const rows: LedgerRow[] = []
  let runningBalance = 0

  const ob = supplierRow.opening_balance_pkr_equivalent
  if (ob !== 0) {
    runningBalance += ob
    rows.push({ id: 'ob', kind: 'opening', date: supplierRow.created_at.split('T')[0], description: 'Opening Balance', debit: ob, credit: 0, balance: runningBalance })
  }

  type RawEntry =
    | { kind: 'purchase';        date: string; entry: typeof purchases[0] }
    | { kind: 'payment';         date: string; entry: typeof payments[0] }
    | { kind: 'purchase_return'; date: string; entry: typeof purchaseReturns[0] }
    | { kind: 'debit_note';      date: string; entry: typeof debitNotes[0] }
    | { kind: 'supplier_refund'; date: string; entry: typeof refunds[0] }

  const entries: RawEntry[] = [
    ...purchases.map((e)       => ({ kind: 'purchase'        as const, date: e.date, entry: e })),
    ...payments.map((e)        => ({ kind: 'payment'         as const, date: e.date, entry: e })),
    ...purchaseReturns.map((e) => ({ kind: 'purchase_return' as const, date: e.date, entry: e })),
    ...debitNotes.map((e)      => ({ kind: 'debit_note'      as const, date: e.date, entry: e })),
    ...refunds.map((e)         => ({ kind: 'supplier_refund' as const, date: e.date, entry: e })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  for (const item of entries) {
    if (item.kind === 'purchase') {
      const net = item.entry.pkr_equivalent - item.entry.advance_paid
      runningBalance += net
      const itemName = lotMap.get(item.entry.stock_item_id) ?? 'Unknown item'
      rows.push({ id: item.entry.id, kind: 'purchase', date: item.date, description: `Purchase — ${itemName} (${item.entry.quantity} units @ ${item.entry.currency_code} ${item.entry.rate})`, debit: net, credit: 0, balance: runningBalance })
    } else if (item.kind === 'purchase_return') {
      const amount = item.entry.pkr_equivalent
      runningBalance -= amount
      const itemName = lotMap.get(item.entry.stock_item_id) ?? 'Unknown item'
      rows.push({ id: item.entry.id, kind: 'purchase_return', date: item.date, description: `Purchase Return — ${itemName} (${item.entry.quantity} units${item.entry.reason ? ` — ${item.entry.reason}` : ''})`, debit: 0, credit: amount, balance: runningBalance })
    } else if (item.kind === 'debit_note') {
      const amount = item.entry.pkr_equivalent
      runningBalance -= amount
      const desc = `Debit Note${item.entry.reason ? ` — ${item.entry.reason}` : ''}${item.entry.reference ? ` (Ref: ${item.entry.reference})` : ''}`
      rows.push({ id: item.entry.id, kind: 'debit_note', date: item.date, description: desc, debit: 0, credit: amount, balance: runningBalance })
    } else if (item.kind === 'supplier_refund') {
      // Money received FROM supplier — increases (or restores) our balance
      const amount = item.entry.pkr_equivalent
      runningBalance += amount
      const method = item.entry.payment_method === 'bank_transfer' ? 'Bank Transfer' : 'Cash'
      const desc = `Payment Received${item.entry.notes ? ` — ${item.entry.notes}` : ''} (${method})`
      rows.push({ id: item.entry.id, kind: 'supplier_refund', date: item.date, description: desc, debit: amount, credit: 0, balance: runningBalance })
    } else {
      const paid = item.entry.pkr_equivalent
      runningBalance -= paid
      rows.push({
        id: item.entry.id,
        kind: 'payment',
        date: item.date,
        description: `Payment${item.entry.payment_method_note ? ` — ${item.entry.payment_method_note}` : ''}`,
        debit: 0,
        credit: paid,
        balance: runningBalance,
        rawPayment: {
          id: item.entry.id,
          amount: item.entry.amount,
          currencyCode: item.entry.currency_code,
          pkrEquivalent: item.entry.pkr_equivalent,
          date: item.entry.date,
          paymentMethodNote: item.entry.payment_method_note,
        },
      })
    }
  }

  const balanceLabel  = runningBalance > 0 ? 'We owe supplier' : runningBalance < 0 ? 'Supplier owes us' : 'Settled'
  const balanceColor  = runningBalance > 0 ? 'text-destructive' : runningBalance < 0 ? 'text-emerald-600' : 'text-muted-foreground'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{supplierRow.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Supplier Ledger</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <PrintButton />
          <ExportButton href={`/api/export/supplier-ledger/${id}`} label="Export" />
          <ReceivePaymentForm supplierId={id} today={today} />
          <RecordPaymentForm supplierId={id} today={today} />
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
        <div>
          <p className="text-sm text-muted-foreground">Outstanding Balance</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{balanceLabel}</p>
        </div>
        <p className={`text-xl font-semibold tabular-nums ${balanceColor}`}>
          {formatPKR(Math.abs(runningBalance))}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No transactions yet.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Description</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Debit (PKR)</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Credit (PKR)</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Balance (PKR)</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-secondary/50 transition-colors ${row.kind === 'supplier_refund' ? 'bg-emerald-50/40 dark:bg-emerald-950/10' : ''}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(row.date))}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.kind === 'supplier_refund'
                        ? <span className="text-emerald-700 dark:text-emerald-400 font-medium">{row.description}</span>
                        : row.description}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.debit > 0 ? formatPKR(row.debit) : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.credit > 0 ? formatPKR(row.credit) : '—'}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${row.balance > 0 ? 'text-destructive' : row.balance < 0 ? 'text-emerald-600' : ''}`}>
                      {formatPKR(Math.abs(row.balance))}
                      {row.balance < 0 && <span className="ml-1 text-xs opacity-60">CR</span>}
                    </td>
                    <td className="px-4 py-3">
                      {row.kind === 'payment' && row.rawPayment && (
                        <RoleGate allowedRoles={['owner']}>
                          <EditApPaymentForm payment={row.rawPayment} />
                        </RoleGate>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
