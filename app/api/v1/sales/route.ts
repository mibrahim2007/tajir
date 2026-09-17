export const runtime = 'nodejs'

import { requireApiKey, logApiRequest } from '@/lib/api-keys/require-api-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadNameMaps } from '@/lib/api/v1/lookups'
import { parseDateRange, parseCreatedSince, parsePagination, page, badRequest, ok } from '@/lib/api/v1/params'

// GET /api/v1/sales                            scope: sales:read
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD            by sale date, inclusive
//   ?customer_id=<uuid>
//   ?created_since=<ISO timestamp>             for incremental sync
//   ?limit=200&offset=0
export async function GET(req: Request) {
  const auth = await requireApiKey(req, 'sales:read')
  if (!auth.ok) return auth.response
  const { ctx } = auth

  const url = new URL(req.url)
  const range = parseDateRange(url)
  if (range.error) return badRequest(range.error)
  const since = parseCreatedSince(url)
  if (since.error) return badRequest(since.error)
  const pg = parsePagination(url)
  if (pg.error) return badRequest(pg.error)
  const customerId = url.searchParams.get('customer_id')

  const admin = createAdminClient()
  let query = admin
    .from('sales_orders')
    .select(
      'id, date, customer_id, stock_item_id, location_id, agent_id, quantity, rate, currency_code, exchange_rate, pkr_equivalent, qty_lbs, nos_carton, weight_per_carton, yarn_type, yarn_weight, po_no, dc_no, serial_number, payment_due_date, due_days, notes, confirmed_at, created_at',
      { count: 'exact' },
    )
    .eq('tenant_id', ctx.tenantId)
  if (range.from) query = query.gte('date', range.from)
  if (range.to) query = query.lte('date', range.to)
  if (customerId) query = query.eq('customer_id', customerId)
  if (since.createdSince) query = query.gt('created_at', since.createdSince)

  const [{ data, count, error }, names] = await Promise.all([
    query.order('date', { ascending: true }).order('created_at', { ascending: true }).range(pg.offset, pg.offset + pg.limit - 1),
    loadNameMaps(admin, ctx.tenantId),
  ])

  if (error) {
    await logApiRequest(req, ctx, 500)
    return Response.json({ error: 'Query failed' }, { status: 500 })
  }

  const rows = (data ?? []).map((s) => ({
    id: s.id,
    date: s.date,
    customer: { id: s.customer_id, name: names.customer.get(s.customer_id) ?? null },
    item: { id: s.stock_item_id, name: names.item.get(s.stock_item_id)?.name ?? null, count: names.item.get(s.stock_item_id)?.count ?? null },
    location: s.location_id ? { id: s.location_id, name: names.location.get(s.location_id) ?? null } : null,
    agent_id: s.agent_id,
    quantity: s.quantity,
    rate: s.rate,
    currency: s.currency_code,
    exchange_rate: s.exchange_rate,
    pkr_equivalent: s.pkr_equivalent,
    qty_lbs: s.qty_lbs,
    nos_carton: s.nos_carton,
    weight_per_carton: s.weight_per_carton,
    yarn_type: s.yarn_type,
    yarn_weight: s.yarn_weight,
    po_no: s.po_no,
    dc_no: s.dc_no,
    serial_number: s.serial_number,
    payment_due_date: s.payment_due_date,
    due_days: s.due_days,
    notes: s.notes,
    confirmed_at: s.confirmed_at,
    created_at: s.created_at,
  }))

  await logApiRequest(req, ctx, 200, rows.length)
  return ok(page(rows, pg.limit, pg.offset, count))
}
