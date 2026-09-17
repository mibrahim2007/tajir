export const runtime = 'nodejs'

import { requireApiKey, logApiRequest } from '@/lib/api-keys/require-api-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadNameMaps } from '@/lib/api/v1/lookups'
import { parseDateRange, parseCreatedSince, parsePagination, page, badRequest, ok } from '@/lib/api/v1/params'

// GET /api/v1/purchases                        scope: purchases:read
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD            by purchase date, inclusive
//   ?supplier_id=<uuid>
//   ?created_since=<ISO timestamp>             for incremental sync
//   ?limit=200&offset=0
export async function GET(req: Request) {
  const auth = await requireApiKey(req, 'purchases:read')
  if (!auth.ok) return auth.response
  const { ctx } = auth

  const url = new URL(req.url)
  const range = parseDateRange(url)
  if (range.error) return badRequest(range.error)
  const since = parseCreatedSince(url)
  if (since.error) return badRequest(since.error)
  const pg = parsePagination(url)
  if (pg.error) return badRequest(pg.error)
  const supplierId = url.searchParams.get('supplier_id')

  const admin = createAdminClient()
  let query = admin
    .from('purchase_orders')
    .select(
      'id, date, supplier_id, stock_item_id, location_id, agent_id, quantity, rate, currency_code, exchange_rate, pkr_equivalent, advance_paid, qty_lbs, nos_carton, weight_per_carton, yarn_type, yarn_weight, supplier_invoice_no, serial_number, payment_due_date, confirmed_at, created_at',
      { count: 'exact' },
    )
    .eq('tenant_id', ctx.tenantId)
  if (range.from) query = query.gte('date', range.from)
  if (range.to) query = query.lte('date', range.to)
  if (supplierId) query = query.eq('supplier_id', supplierId)
  if (since.createdSince) query = query.gt('created_at', since.createdSince)

  const [{ data, count, error }, names] = await Promise.all([
    query.order('date', { ascending: true }).order('created_at', { ascending: true }).range(pg.offset, pg.offset + pg.limit - 1),
    loadNameMaps(admin, ctx.tenantId),
  ])

  if (error) {
    await logApiRequest(req, ctx, 500)
    return Response.json({ error: 'Query failed' }, { status: 500 })
  }

  const rows = (data ?? []).map((p) => ({
    id: p.id,
    date: p.date,
    supplier: { id: p.supplier_id, name: names.supplier.get(p.supplier_id) ?? null },
    item: { id: p.stock_item_id, name: names.item.get(p.stock_item_id)?.name ?? null, count: names.item.get(p.stock_item_id)?.count ?? null },
    location: p.location_id ? { id: p.location_id, name: names.location.get(p.location_id) ?? null } : null,
    agent_id: p.agent_id,
    quantity: p.quantity,
    rate: p.rate,
    currency: p.currency_code,
    exchange_rate: p.exchange_rate,
    pkr_equivalent: p.pkr_equivalent,
    advance_paid: p.advance_paid,
    qty_lbs: p.qty_lbs,
    nos_carton: p.nos_carton,
    weight_per_carton: p.weight_per_carton,
    yarn_type: p.yarn_type,
    yarn_weight: p.yarn_weight,
    supplier_invoice_no: p.supplier_invoice_no,
    serial_number: p.serial_number,
    payment_due_date: p.payment_due_date,
    confirmed_at: p.confirmed_at,
    created_at: p.created_at,
  }))

  await logApiRequest(req, ctx, 200, rows.length)
  return ok(page(rows, pg.limit, pg.offset, count))
}
