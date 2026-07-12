import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { RecordReceiptForm } from '@/app/(app)/customers/record-receipt-form'
import { EditArReceiptForm } from '@/app/(app)/customers/edit-ar-receipt-form'
import { RefundCustomerForm } from '@/app/(app)/customers/refund-customer-form'
import { ExportButton } from '@/components/export-button'
import { PrintButton } from '@/components/print-button'
import { RoleGate } from '@/components/role-gate'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'

type Props = { params: Promise<{ id: string }> }

export default async function CustomerLedgerPage({ params }: Props) {
  const { tenantId } = await requireAuth()
  const { id } = await params
  const today = new Date().toISOString().split('T')[0]

  const admin = createAdminClient()

  const { data: customerRow } = await admin
    .from('tajir_customers')
    .select('id, name, opening_balance_pkr_equivalent, created_at')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!customerRow) notFound()

  const [nextReceiptSerial, nextRefundSerial] = await Promise.all([
    peekNextDocumentSerial(admin, tenantId, 'ar_receipt', today),
    peekNextDocumentSerial(admin, tenantId, 'customer_refund', today),
  ])

  const [{ data: rawSales }, { data: rawReceipts }, { data: rawReturns }, { data: rawCreditNotes }, { data: rawRefunds }, { data: rawLots }] = await Promise.all([
    admin.from('sales_orders')
      .select('id, date, customer_id, stock_item_id, quantity, rate, currency_code, pkr_equivalent')
      .eq('customer_id', id)
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true }),
    admin.from('ar_receipts')
      .select('id, date, customer_id, amount, currency_code, pkr_equivalent, payment_method_note, serial_number')
      .eq('customer_id', id)
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true }),
    admin.from('sale_returns')
      .select('id, date, customer_id, stock_item_id, quantity, rate, currency_code, pkr_equivalent, reason')
      .eq('customer_id', id)
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true }),
    admin.from('credit_notes')
      .select('id, date, customer_id, amount, currency_code, pkr_equivalent, reason, reference')
      .eq('customer_id', id)
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true }),
    admin.from('customer_refunds')
      .select('id, date, customer_id, amount, currency_code, pkr_equivalent, payment_method, notes, serial_number')
      .eq('customer_id', id)
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true }),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
  ])

  const { data: rawBanks } = await admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name')
  const banks = rawBanks ?? []

  const sales = rawSales ?? []
  const receipts = rawReceipts ?? []
  const saleReturns = rawReturns ?? []
  const creditNotes = rawCreditNotes ?? []
  const refunds = rawRefunds ?? []
  const lotMap = new Map((rawLots ?? []).map((l) => [l.id, l.name]))

  type LedgerRow = {
    id: string
    kind: 'opening' | 'sale' | 'receipt' | 'sale_return' | 'credit_note' | 'refund'
    date: string
    description: string
    debit: number
    credit: number
    balance: number
    rawReceipt?: { id: string; amount: number; currencyCode: string; pkrEquivalent: number; date: string; paymentMethodNote: string | null }
  }

  const rows: LedgerRow[] = []
  let runningBalance = 0

  const ob = customerRow.opening_balance_pkr_equivalent
  if (ob !== 0) {
    runningBalance += ob
    rows.push({ id: 'ob', kind: 'opening', date: customerRow.created_at.split('T')[0], description: 'Opening Balance', debit: ob, credit: 0, balance: runningBalance })
  }

  type RawEntry =
    | { kind: 'sale'; date: string; entry: typeof sales[0] }
    | { kind: 'receipt'; date: string; entry: typeof receipts[0] }
    | { kind: 'sale_return'; date: string; entry: typeof saleReturns[0] }
    | { kind: 'credit_note'; date: string; entry: typeof creditNotes[0] }
    | { kind: 'refund'; date: string; entry: typeof refunds[0] }

  const entries: RawEntry[] = [
    ...sales.map((e) => ({ kind: 'sale' as const, date: e.date, entry: e })),
    ...receipts.map((e) => ({ kind: 'receipt' as const, date: e.date, entry: e })),
    ...saleReturns.map((e) => ({ kind: 'sale_return' as const, date: e.date, entry: e })),
    ...creditNotes.map((e) => ({ kind: 'credit_note' as const, date: e.date, entry: e })),
    ...refunds.map((e) => ({ kind: 'refund' as const, date: e.date, entry: e })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  for (const item of entries) {
    if (item.kind === 'sale') {
      const amount = item.entry.pkr_equivalent
      runningBalance += amount
      const itemName = lotMap.get(item.entry.stock_item_id) ?? 'Unknown item'
      rows.push({ id: item.entry.id, kind: 'sale', date: item.date, description: `Sale — ${itemName} (${item.entry.quantity} units @ ${item.entry.currency_code} ${item.entry.rate})`, debit: amount, credit: 0, balance: runningBalance })
    } else if (item.kind === 'sale_return') {
      const amount = item.entry.pkr_equivalent
      runningBalance -= amount
      const itemName = lotMap.get(item.entry.stock_item_id) ?? 'Unknown item'
      rows.push({ id: item.entry.id, kind: 'sale_return', date: item.date, description: `Sale Return — ${itemName} (${item.entry.quantity} units${item.entry.reason ? ` — ${item.entry.reason}` : ''})`, debit: 0, credit: amount, balance: runningBalance })
    } else if (item.kind === 'credit_note') {
      const amount = item.entry.pkr_equivalent
      runningBalance -= amount
      const desc = `Credit Note${item.entry.reason ? ` — ${item.entry.reason}` : ''}${item.entry.reference ? ` (Ref: ${item.entry.reference})` : ''}`
      rows.push({ id: item.entry.id, kind: 'credit_note', date: item.date, description: desc, debit: 0, credit: amount, balance: runningBalance })
    } else if (item.kind === 'refund') {
      const amount = item.entry.pkr_equivalent
      // Refund increases the AR balance (we paid them back, so credit is consumed)
      runningBalance += amount
      const method = item.entry.payment_method === 'bank_transfer' ? 'Bank Transfer' : item.entry.payment_method === 'cash' ? 'Cash' : 'Mixed'
      const ref = item.entry.serial_number ? `${item.entry.serial_number} · ` : ''
      rows.push({ id: item.entry.id, kind: 'refund', date: item.date, description: `${ref}Customer Refund — ${method}${item.entry.notes ? ` (${item.entry.notes})` : ''}`, debit: amount, credit: 0, balance: runningBalance })
    } else {
      const amount = item.entry.pkr_equivalent
      runningBalance -= amount
      rows.push({
        id: item.entry.id,
        kind: 'receipt',
        date: item.date,
        description: `${item.entry.serial_number ? `${item.entry.serial_number} · ` : ''}Receipt${item.entry.payment_method_note ? ` — ${item.entry.payment_method_note}` : ''}`,
        debit: 0,
        credit: amount,
        balance: runningBalance,
        rawReceipt: {
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{customerRow.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Customer Ledger</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <PrintButton />
          <ExportButton href={`/api/export/customer-ledger/${id}`} label="Export" />
          {runningBalance < 0 && (
            <RoleGate allowedRoles={['owner']}>
              <RefundCustomerForm customerId={id} today={today} creditAmount={Math.abs(runningBalance)} nextSerial={nextRefundSerial} banks={banks} />
            </RoleGate>
          )}
          <RecordReceiptForm customerId={id} today={today} nextSerial={nextReceiptSerial} banks={banks} />
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
        {runningBalance < 0 ? (
          <>
            <p className="text-sm text-muted-foreground">Credit Balance <span className="text-xs">(customer is in credit)</span></p>
            <p className="text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatPKR(Math.abs(runningBalance))} CR
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Outstanding Balance</p>
            <p className={`text-xl font-semibold tabular-nums ${runningBalance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
              {formatPKR(runningBalance)}
            </p>
          </>
        )}
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
                  <tr key={row.id} className={`hover:bg-secondary/50 transition-colors ${row.kind === 'refund' ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(row.date))}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.description}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.debit > 0 ? formatPKR(row.debit) : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.credit > 0 ? formatPKR(row.credit) : '—'}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${row.balance > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                      {formatPKR(row.balance)}
                    </td>
                    <td className="px-4 py-3">
                      {row.kind === 'receipt' && row.rawReceipt && (
                        <RoleGate allowedRoles={['owner']}>
                          <EditArReceiptForm receipt={row.rawReceipt} />
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
