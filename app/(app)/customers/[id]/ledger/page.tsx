import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { RecordReceiptForm } from '@/app/(app)/customers/record-receipt-form'
import { EditArReceiptForm } from '@/app/(app)/customers/edit-ar-receipt-form'
import { ExportButton } from '@/components/export-button'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deleteSaleAction } from '@/app/actions/delete-sale'
import { deleteArReceiptAction } from '@/app/actions/delete-ar-receipt'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

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

  const [{ data: rawSales }, { data: rawReceipts }, { data: rawLots }] = await Promise.all([
    admin.from('sales_orders')
      .select('id, date, customer_id, stock_item_id, quantity, rate, currency_code, pkr_equivalent')
      .eq('customer_id', id)
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true }),
    admin.from('ar_receipts')
      .select('id, date, customer_id, amount, currency_code, pkr_equivalent, payment_method_note')
      .eq('customer_id', id)
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true }),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
  ])

  const sales = rawSales ?? []
  const receipts = rawReceipts ?? []
  const lotMap = new Map((rawLots ?? []).map((l) => [l.id, l.name]))

  type LedgerRow = {
    id: string
    kind: 'opening' | 'sale' | 'receipt'
    date: string
    description: string
    debit: number
    credit: number
    balance: number
    rawReceipt?: { id: string; amount: string; currencyCode: string; pkrEquivalent: string; date: string; paymentMethodNote: string | null }
  }

  const rows: LedgerRow[] = []
  let runningBalance = 0

  const ob = parseFloat(customerRow.opening_balance_pkr_equivalent)
  if (ob !== 0) {
    runningBalance += ob
    rows.push({ id: 'ob', kind: 'opening', date: customerRow.created_at.split('T')[0], description: 'Opening Balance', debit: ob, credit: 0, balance: runningBalance })
  }

  type RawEntry =
    | { kind: 'sale'; date: string; entry: typeof sales[0] }
    | { kind: 'receipt'; date: string; entry: typeof receipts[0] }

  const entries: RawEntry[] = [
    ...sales.map((e) => ({ kind: 'sale' as const, date: e.date, entry: e })),
    ...receipts.map((e) => ({ kind: 'receipt' as const, date: e.date, entry: e })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  for (const item of entries) {
    if (item.kind === 'sale') {
      const amount = parseFloat(item.entry.pkr_equivalent)
      runningBalance += amount
      const itemName = lotMap.get(item.entry.stock_item_id) ?? 'Unknown item'
      rows.push({ id: item.entry.id, kind: 'sale', date: item.date, description: `Sale — ${itemName} (${item.entry.quantity} units @ ${item.entry.currency_code} ${item.entry.rate})`, debit: amount, credit: 0, balance: runningBalance })
    } else {
      const amount = parseFloat(item.entry.pkr_equivalent)
      runningBalance -= amount
      rows.push({
        id: item.entry.id,
        kind: 'receipt',
        date: item.date,
        description: `Receipt${item.entry.payment_method_note ? ` — ${item.entry.payment_method_note}` : ''}`,
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
          <h1 className="text-2xl font-semibold">{customerRow.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Customer Ledger</p>
        </div>
        <div className="flex gap-2">
          <ExportButton href={`/api/export/customer-ledger/${id}`} label="Export" />
          <RecordReceiptForm customerId={id} today={today} />
        </div>
      </div>

      <div className="mb-6 text-right">
        <p className="text-sm text-muted-foreground">Outstanding Balance</p>
        <p className={`text-2xl font-semibold tabular-nums ${runningBalance > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
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
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${row.balance > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                      {formatPKR(row.balance)}
                    </td>
                    <td className="px-4 py-3">
                      {row.kind !== 'opening' && (
                        <RoleGate allowedRoles={['owner']}>
                          <div className="flex items-center gap-1">
                            {row.kind === 'receipt' && row.rawReceipt && (
                              <EditArReceiptForm receipt={row.rawReceipt} />
                            )}
                            <DeleteButton
                              description={row.kind === 'sale' ? 'Delete this sale? Stock will be restored.' : 'Delete this receipt?'}
                              onDelete={row.kind === 'sale' ? deleteSaleAction.bind(null, { id: row.id }) : deleteArReceiptAction.bind(null, { id: row.id })}
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
