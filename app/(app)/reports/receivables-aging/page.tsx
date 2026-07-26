import { requireAuth } from '@/lib/auth/require-auth'
import { formatPKR } from '@/lib/utils/currency'
import { ExportButton } from '@/components/export-button'
import { buildReceivablesAging, sumBuckets } from '@/lib/reports/aging'

export default async function ReceivablesAgingPage() {
  const { tenantId } = await requireAuth()
  const rows = await buildReceivablesAging(tenantId)
  const totals = sumBuckets(rows)

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
                  <tr key={r.partyId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{r.partyName}</td>
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
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-600 dark:text-amber-400">{formatPKR(totals.total)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatPKR(totals.bucket0_30)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatPKR(totals.bucket31_60)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatPKR(totals.bucket61_90)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatPKR(totals.bucket90plus)}</td>
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
