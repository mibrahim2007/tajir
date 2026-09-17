export const runtime = 'nodejs'

import { requireApiKey, logApiRequest } from '@/lib/api-keys/require-api-key'
import { buildReceivablesAging, buildEmployeeLoanAging, sumBuckets, type AgingRow, type AgingBuckets } from '@/lib/reports/aging'
import { round2, ok } from '@/lib/api/v1/params'

// GET /api/v1/reports/receivables-aging       scope: reports:read
// Same builders as the on-screen report and the Excel export, so the three
// cannot disagree. Buckets are days since the dated debit, settled FIFO.

const buckets = (b: AgingBuckets) => ({
  total: round2(b.total),
  '0_30': round2(b.bucket0_30),
  '31_60': round2(b.bucket31_60),
  '61_90': round2(b.bucket61_90),
  '90_plus': round2(b.bucket90plus),
  oldest_date: b.oldestDate,
})

const section = (rows: AgingRow[]) => ({
  rows: rows.map((r) => ({ id: r.partyId, name: r.partyName, ...buckets(r) })),
  totals: buckets(sumBuckets(rows)),
})

export async function GET(req: Request) {
  const auth = await requireApiKey(req, 'reports:read')
  if (!auth.ok) return auth.response
  const { ctx } = auth

  const [customerRows, employeeRows] = await Promise.all([
    buildReceivablesAging(ctx.tenantId),
    buildEmployeeLoanAging(ctx.tenantId),
  ])

  const body = {
    as_of: new Date().toISOString(),
    currency: 'PKR',
    customers: section(customerRows),
    employee_loans: section(employeeRows),
    totals: buckets(sumBuckets([...customerRows, ...employeeRows])),
  }

  await logApiRequest(req, ctx, 200, customerRows.length + employeeRows.length)
  return ok(body)
}
