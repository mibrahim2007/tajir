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
  supplierId: string
  supplierName: string
  total: number
  bucket0_30: number
  bucket31_60: number
  bucket61_90: number
  bucket90plus: number
  oldestDate: string | null
}

export default async function PayablesAgingPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: rawSuppliers }, { data: rawPurchases }, { data: rawPayments }] = await Promise.all([
    admin.from('suppliers').select('id, name, opening_balance_pkr_equivalent, created_at').eq('tenant_id', tenantId),
    admin.from('purchase_orders').select('id, supplier_id, pkr_equivalent, advance_paid, date').eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('ap_payments').select('supplier_id, pkr_equivalent').eq('tenant_id', tenantId),
  ])

  const allSuppliers = rawSuppliers ?? []
  const allPurchases = rawPurchases ?? []
  const allPayments = rawPayments ?? []

  const rows: AgingRow[] = []

  for (const s of allSuppliers) {
    const sPurchases = allPurchases
      .filter((p) => p.supplier_id === s.id)
      .map((p) => ({
        date: p.date,
        net: p.pkr_equivalent - p.advance_paid,
      }))
      .filter((p) => p.net > 0)

    const totalPaid = allPayments
      .filter((p) => p.supplier_id === s.id)
      .reduce((sum, p) => sum + p.pkr_equivalent, 0)

    const lineItems: { date: string; amount: number }[] = [
      ...(s.opening_balance_pkr_equivalent > 0
        ? [{ date: s.created_at.split('T')[0], amount: s.opening_balance_pkr_equivalent }]
        : []),
      ...sPurchases.map((p) => ({ date: p.date, amount: p.net })),
    ].sort((a, b) => a.date.localeCompare(b.date))

    let remainingPayment = totalPaid
    let totalOutstanding = 0
    let bucket0_30 = 0, bucket31_60 = 0, bucket61_90 = 0, bucket90plus = 0
    let oldestDate: string | null = null

    for (const line of lineItems) {
      let remaining = line.amount
      if (remainingPayment > 0) {
        const allocated = Math.min(remainingPayment, remaining)
        remaining -= allocated
        remainingPayment -= allocated
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
      rows.push({ supplierId: s.id, supplierName: s.name, total: totalOutstanding, bucket0_30, bucket31_60, bucket61_90, bucket90plus, oldestDate })
    }
  }

  rows.sort((a, b) => b.total - a.total)

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Payables Aging</h1>
          <p className="text-sm text-muted-foreground mt-1">Outstanding amounts by supplier, aged from purchase date to today.</p>
        </div>
        <ExportButton href="/api/export/payables-aging" />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No outstanding payables.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Supplier</th>
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
                  <tr key={r.supplierId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{r.supplierName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-destructive">{formatPKR(r.total)}</td>
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
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-destructive">{formatPKR(grandTotal)}</td>
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
