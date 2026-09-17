export const runtime = 'nodejs'

import { requireApiKey, logApiRequest } from '@/lib/api-keys/require-api-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseCreatedSince, parsePagination, page, badRequest, ok } from '@/lib/api/v1/params'

// GET /api/v1/suppliers                        scope: suppliers:read
//   ?created_since=<ISO timestamp>             only suppliers added after this
//   ?limit=200&offset=0
export async function GET(req: Request) {
  const auth = await requireApiKey(req, 'suppliers:read')
  if (!auth.ok) return auth.response
  const { ctx } = auth

  const url = new URL(req.url)
  const since = parseCreatedSince(url)
  if (since.error) return badRequest(since.error)
  const pg = parsePagination(url)
  if (pg.error) return badRequest(pg.error)

  const admin = createAdminClient()
  let query = admin
    .from('suppliers')
    .select('id, name, email, opening_balance, opening_balance_currency, opening_balance_pkr_equivalent, created_at', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
  if (since.createdSince) query = query.gt('created_at', since.createdSince)

  const { data, count, error } = await query
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(pg.offset, pg.offset + pg.limit - 1)

  if (error) {
    await logApiRequest(req, ctx, 500)
    return Response.json({ error: 'Query failed' }, { status: 500 })
  }

  const rows = (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    opening_balance: { amount: s.opening_balance, currency: s.opening_balance_currency, pkr_equivalent: s.opening_balance_pkr_equivalent },
    created_at: s.created_at,
  }))

  await logApiRequest(req, ctx, 200, rows.length)
  return ok(page(rows, pg.limit, pg.offset, count))
}
