export const runtime = 'nodejs'

import { requireApiKey, logApiRequest } from '@/lib/api-keys/require-api-key'
import { buildPayablesAging, sumBuckets, type AgingBuckets } from '@/lib/reports/aging'
import { round2, ok } from '@/lib/api/v1/params'

// GET /api/v1/reports/payables-aging          scope: reports:read
// Same builder as the on-screen report and the Excel export.

const buckets = (b: AgingBuckets) => ({
  total: round2(b.total),
  '0_30': round2(b.bucket0_30),
  '31_60': round2(b.bucket31_60),
  '61_90': round2(b.bucket61_90),
  '90_plus': round2(b.bucket90plus),
  oldest_date: b.oldestDate,
})

export async function GET(req: Request) {
  const auth = await requireApiKey(req, 'reports:read')
  if (!auth.ok) return auth.response
  const { ctx } = auth

  const rows = await buildPayablesAging(ctx.tenantId)

  const body = {
    as_of: new Date().toISOString(),
    currency: 'PKR',
    suppliers: {
      rows: rows.map((r) => ({ id: r.partyId, name: r.partyName, ...buckets(r) })),
      totals: buckets(sumBuckets(rows)),
    },
  }

  await logApiRequest(req, ctx, 200, rows.length)
  return ok(body)
}
