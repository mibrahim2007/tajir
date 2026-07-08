import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { ExportButton } from '@/components/export-button'

function ageDays(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  return Math.floor((today.getTime() - d.getTime()) / 86_400_000)
}

type AgingRow = {
  customerId: string
  customerName: string
  total: number
  bucket0_30: number
  bucket31_60: number
  bucket61_90: number
  bucket90plus: number
  oldestDate: string | null
}

export default async function ReceivablesAgingPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: rawCustomers }, { data: rawSales }, { data: rawReceipts }, { data: rawReturns }, { data: rawCreditNotes }, { data: rawRefunds }] = await Promise.all([
    admin.from('tajir_customers').select('id, name, opening_balance_pkr_equivalent, created_at').eq('tenant_id', tenantId),
    admin.from('sales_orders').select('customer_id, pkr_equivalent, date').eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('ar_receipts').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('sale_returns').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('credit_notes').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('customer_refunds').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId),
  ])

  const allCustomers = rawCustomers ?? []
  const allSales = rawSales ?? []
  const allReceipts = rawReceipts ?? []
  const allReturns = rawReturns ?? []
  const allCreditNotes = rawCreditNotes ?? []
  const allRefunds = rawRefunds ?? []

  const rows: AgingRow[] = []

  for (const c of allCustomers) {
    const cSales = allSales
      .filter((s) => s.customer_id === c.id)
      .map((s) => ({ date: s.date, amount: s.pkr_equivalent }))

    const totalReceived = allReceipts
      .filter((r) => r.customer_id === c.id)
      .reduce((sum, r) => sum + r.pkr_equivalent, 0)

    const totalReturned = allReturns
      .filter((r) => r.customer_id === c.id)
      .reduce((sum, r) => sum + r.pkr_equivalent, 0)

    const totalCredited = allCreditNotes
      .filter((n) => n.customer_id === c.id)
      .reduce((sum, n) => sum + n.pkr_equivalent, 0)

    const totalRefunded = allRefunds
      .filter((r) => r.customer_id === c.id)
      .reduce((sum, r) => sum + r.pkr_equivalent, 0)

    // Refunds consume the customer's credit balance, so they reduce net credits
    const totalCredits = totalReceived + totalReturned + totalCredited - totalRefunded

    const lineItems: { date: string; amount: number }[] = [
      ...(c.opening_balance_pkr_equivalent > 0
        ? [{ date: c.created_at.split('T')[0], amount: c.opening_balance_pkr_equivalent }]
        : []),
      ...cSales,
    ].sort((a, b) => a.date.localeCompare(b.date))

    let remainingReceipt = totalCredits
    let totalOutstanding = 0
    let bucket0_30 = 0, bucket31_60 = 0, bucket61_90 = 0, bucket90plus = 0
    let oldestDate: string | null = null

    for (const line of lineItems) {
      let remaining = line.amount
      if (remainingReceipt > 0) {
        const allocated = Math.min(remainingReceipt, remaining)
        remaining -= allocated
        remainingReceipt -= allocated
      }
      if (remaining <= 0) continue

      totalOutstanding += remaining
      if (!oldestDate || line.date < oldestDate) oldestDate = line.date

      const age = ageDays(line.date)
      if (age <= 30) bucket0_30 += remaining
      else if (age <= 60) bucket31_60 += remaining
      else if (age <= 90) bucket61_90 += remaining
      else bucket90plus += remaining
    }

    if (totalOutstanding > 0.005) {
      rows.push({ customerId: c.id, customerName: c.name, total: totalOutstanding, bucket0_30, bucket31_60, bucket61_90, bucket90plus, oldestDate })
    }
  }

  rows.sort((a, b) => b.total - a.total)

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Receivables Aging</h1>
          <p className="text-sm text-muted-foreground mt-1">Outstanding amounts by customer, aged from sale date to today.</p>
        </div>
        <ExportButton href="/api/export/receivables-aging" />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No outstanding receivables.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-right px-4 py-3 font-medium">Total (PKR)</th>
                  <th className="text-right px-4 py-3 font-medium">0–30 days</th>
                  <th className="text-right px-4 py-3 font-medium">31–60 days</th>
                  <th className="text-right px-4 py-3 font-medium">61–90 days</th>
                  <th className="text-right px-4 py-3 font-medium">90+ days</th>
                  <th className="text-right px-4 py-3 font-medium">Oldest</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.customerId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{r.customerName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">{formatPKR(r.total)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.bucket0_30 > 0 ? formatPKR(r.bucket0_30) : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.bucket31_60 > 0 ? formatPKR(r.bucket31_60) : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.bucket61_90 > 0 ? formatPKR(r.bucket61_90) : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.bucket90plus > 0 ? formatPKR(r.bucket90plus) : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.oldestDate ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30">
                <tr>
                  <td className="px-4 py-3 font-semibold">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-600 dark:text-amber-400">{formatPKR(grandTotal)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatPKR(rows.reduce((s,r)=>s+r.bucket0_30,0))}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatPKR(rows.reduce((s,r)=>s+r.bucket31_60,0))}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatPKR(rows.reduce((s,r)=>s+r.bucket61_90,0))}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatPKR(rows.reduce((s,r)=>s+r.bucket90plus,0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
