import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { RecordPaymentForm } from '@/app/(app)/suppliers/record-payment-form'
import { EditApPaymentForm } from '@/app/(app)/suppliers/edit-ap-payment-form'
import { ExportButton } from '@/components/export-button'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deleteApPaymentAction } from '@/app/actions/delete-ap-payment'
import { deletePurchaseAction } from '@/app/actions/delete-purchase'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

type Props = { params: Promise<{ id: string }> }

export default async function SupplierLedgerPage({ params }: Props) {
  const { tenantId } = await requireAuth()
  const { id } = await params

  const admin = createAdminClient()

  const { data: supplierRow } = await admin
    .from('suppliers')
    .select('id, name, opening_balance_pkr_equivalent, created_at')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!supplierRow) notFound()

  const [{ data: rawPurchases }, { data: rawPayments }, { data: rawLots }] = await Promise.all([
    admin.from('purchase_orders')
      .select('id, date, supplier_id, stock_item_id, quantity, rate, currency_code, pkr_equivalent, advance_paid')
      .eq('supplier_id', id)
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true }),
    admin.from('ap_payments')
      .select('id, date, supplier_id, amount, currency_code, pkr_equivalent, payment_method_note')
      .eq('supplier_id', id)
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true }),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
  ])

  const purchases = rawPurchases ?? []
  const payments = rawPayments ?? []
  const lotMap = new Map((rawLots ?? []).map((l) => [l.id, l.name]))

  type LedgerRow = {
    id: string
    kind: 'opening' | 'purchase' | 'payment'
    date: string
    description: string
    debit: number
    credit: number
    balance: number
    rawPayment?: { id: string; amount: string; currencyCode: string; pkrEquivalent: string; date: string; paymentMethodNote: string | null }
  }

  const rows: LedgerRow[] = []
  let runningBalance = 0

  const ob = parseFloat(supplierRow.opening_balance_pkr_equivalent)
  if (ob !== 0) {
    runningBalance += ob
    rows.push({ id: 'ob', kind: 'opening', date: supplierRow.created_at.split('T')[0], description: 'Opening Balance', debit: ob, credit: 0, balance: runningBalance })
  }

  type RawEntry =
    | { kind: 'purchase'; date: string; entry: typeof purchases[0] }
    | { kind: 'payment'; date: string; entry: typeof payments[0] }

  const entries: RawEntry[] = [
    ...purchases.map((e) => ({ kind: 'purchase' as const, date: e.date, entry: e })),
    ...payments.map((e) => ({ kind: 'payment' as const, date: e.date, entry: e })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  for (const item of entries) {
    if (item.kind === 'purchase') {
      const net = parseFloat(item.entry.pkr_equivalent) - parseFloat(item.entry.advance_paid)
      runningBalance += net
      const itemName = lotMap.get(item.entry.stock_item_id) ?? 'Unknown item'
      rows.push({ id: item.entry.id, kind: 'purchase', date: item.date, description: `Purchase — ${itemName} (${item.entry.quantity} units @ ${item.entry.currency_code} ${item.entry.rate})`, debit: net, credit: 0, balance: runningBalance })
    } else {
      const paid = parseFloat(item.entry.pkr_equivalent)
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold">{supplierRow.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Supplier Ledger</p>
        </div>
        <div className="flex gap-2">
          <ExportButton href={`/api/export/supplier-ledger/${id}`} label="Export" />
          <RecordPaymentForm supplierId={id} />
        </div>
      </div>

      <div className="mb-6 text-right">
        <p className="text-sm text-muted-foreground">Outstanding Balance</p>
        <p className={`text-2xl font-semibold tabular-nums ${runningBalance > 0 ? 'text-destructive' : ''}`}>
          {formatPKR(runningBalance)}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No transactions yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-right px-4 py-3 font-medium">Debit (PKR)</th>
                  <th className="text-right px-4 py-3 font-medium">Credit (PKR)</th>
                  <th className="text-right px-4 py-3 font-medium">Balance (PKR)</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(row.date))}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.description}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.debit > 0 ? formatPKR(row.debit) : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.credit > 0 ? formatPKR(row.credit) : '—'}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${row.balance > 0 ? 'text-destructive' : ''}`}>
                      {formatPKR(row.balance)}
                    </td>
                    <td className="px-4 py-3">
                      {row.kind !== 'opening' && (
                        <RoleGate allowedRoles={['owner']}>
                          <div className="flex items-center gap-1">
                            {row.kind === 'payment' && row.rawPayment && (
                              <EditApPaymentForm payment={row.rawPayment} />
                            )}
                            <DeleteButton
                              description={row.kind === 'purchase' ? 'Delete this purchase? Stock will be reversed.' : 'Delete this payment?'}
                              onDelete={row.kind === 'purchase' ? deletePurchaseAction.bind(null, { id: row.id }) : deleteApPaymentAction.bind(null, { id: row.id })}
                            />
                          </div>
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
