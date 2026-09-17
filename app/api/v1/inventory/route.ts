export const runtime = 'nodejs'

import { requireApiKey, logApiRequest } from '@/lib/api-keys/require-api-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { parsePagination, page, badRequest, ok } from '@/lib/api/v1/params'

// GET /api/v1/inventory                        scope: inventory:read
//   ?type=<exact>&count=<contains>&fiber=<contains>&lot=<contains>
//   ?limit=200&offset=0
// Current stock per item, as in Reports → Stock Summary.
export async function GET(req: Request) {
  const auth = await requireApiKey(req, 'inventory:read')
  if (!auth.ok) return auth.response
  const { ctx } = auth

  const url = new URL(req.url)
  const pg = parsePagination(url)
  if (pg.error) return badRequest(pg.error)
  const filterType = url.searchParams.get('type')
  const filterCount = url.searchParams.get('count')
  const filterFiber = url.searchParams.get('fiber')
  const filterLot = url.searchParams.get('lot')

  const admin = createAdminClient()
  let query = admin
    .from('inventory_lots')
    .select('id, sku, name, code, count, type, fiber, lot, item_nature, item_type_id, unit_of_measure, current_quantity, opening_rate, default_supplier_id, location_id, created_at', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
  if (filterType) query = query.eq('type', filterType)
  if (filterCount) query = query.ilike('count', `%${filterCount}%`)
  if (filterFiber) query = query.ilike('fiber', `%${filterFiber}%`)
  if (filterLot) query = query.ilike('lot', `%${filterLot}%`)

  const [{ data, count, error }, { data: suppliers }, { data: locations }] = await Promise.all([
    query.order('name', { ascending: true }).order('id', { ascending: true }).range(pg.offset, pg.offset + pg.limit - 1),
    admin.from('suppliers').select('id, name').eq('tenant_id', ctx.tenantId),
    admin.from('locations').select('id, name').eq('tenant_id', ctx.tenantId),
  ])

  if (error) {
    await logApiRequest(req, ctx, 500)
    return Response.json({ error: 'Query failed' }, { status: 500 })
  }

  const supplierMap = new Map((suppliers ?? []).map((s) => [s.id, s.name]))
  const locationMap = new Map((locations ?? []).map((l) => [l.id, l.name]))

  const rows = (data ?? []).map((l) => ({
    id: l.id,
    sku: l.sku,
    name: l.name,
    code: l.code,
    count: l.count,
    type: l.type,
    fiber: l.fiber,
    lot: l.lot,
    item_nature: l.item_nature,
    item_type_id: l.item_type_id,
    unit_of_measure: l.unit_of_measure,
    current_quantity: l.current_quantity,
    opening_rate: l.opening_rate,
    default_supplier: l.default_supplier_id ? { id: l.default_supplier_id, name: supplierMap.get(l.default_supplier_id) ?? null } : null,
    location: l.location_id ? { id: l.location_id, name: locationMap.get(l.location_id) ?? null } : null,
    created_at: l.created_at,
  }))

  await logApiRequest(req, ctx, 200, rows.length)
  return ok(page(rows, pg.limit, pg.offset, count))
}
