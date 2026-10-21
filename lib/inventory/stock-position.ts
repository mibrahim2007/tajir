import type { SupabaseClient } from '@supabase/supabase-js'

// On-hand stock per item × location × grade × lot, from the stock_position
// view (migration 0072). `quantity` is in the item's stock unit (kg for weighed
// yarn, Nos for count items); `packs` counts cartons / bags.

export type StockPosition = {
  stockItemId: string
  locationId:  string
  gradeId:     string | null
  lotNo:       string | null
  quantity:    number
  packs:       number
}

export async function loadStockPositions(
  admin: SupabaseClient,
  tenantId: string,
  filter: { stockItemIds?: string[]; locationId?: string | null } = {},
): Promise<StockPosition[]> {
  let q = admin
    .from('stock_position')
    .select('stock_item_id, location_id, grade_id, lot_no, quantity, packs')
    .eq('tenant_id', tenantId)
  if (filter.stockItemIds) {
    const ids = [...new Set(filter.stockItemIds.filter(Boolean))]
    if (ids.length === 0) return []
    q = q.in('stock_item_id', ids)
  }
  if (filter.locationId) q = q.eq('location_id', filter.locationId)
  const { data } = await q
  return ((data ?? []) as {
    stock_item_id: string; location_id: string; grade_id: string | null; lot_no: string | null
    quantity: number | string | null; packs: number | string | null
  }[]).map((r) => ({
    stockItemId: r.stock_item_id,
    locationId:  r.location_id,
    gradeId:     r.grade_id,
    lotNo:       r.lot_no,
    quantity:    Number(r.quantity) || 0,
    packs:       Number(r.packs) || 0,
  }))
}

// Blank lot numbers are stored as null; compare them the same way.
export const normalizeLotNo = (lot?: string | null) => (lot ?? '').trim() || null

export function positionKey(p: { stockItemId: string; locationId: string; gradeId?: string | null; lotNo?: string | null }) {
  return `${p.stockItemId}|${p.locationId}|${p.gradeId ?? ''}|${normalizeLotNo(p.lotNo) ?? ''}`
}

// Stock available for one item at one location, narrowed by grade and/or lot
// when given (an undefined filter means "any").
export function availableAt(
  positions: StockPosition[],
  q: { stockItemId: string; locationId: string; gradeId?: string | null; lotNo?: string | null },
): { quantity: number; packs: number } {
  const lot = q.lotNo === undefined ? undefined : normalizeLotNo(q.lotNo)
  let quantity = 0
  let packs = 0
  for (const p of positions) {
    if (p.stockItemId !== q.stockItemId || p.locationId !== q.locationId) continue
    if (q.gradeId !== undefined && p.gradeId !== q.gradeId) continue
    if (lot !== undefined && p.lotNo !== lot) continue
    quantity += p.quantity
    packs += p.packs
  }
  return { quantity, packs }
}

// Lot number given to a tracked purchase line left blank: the invoice serial
// plus the line number, e.g. "PI-2026-0012/2".
export function autoLotNo(serialNumber: string | null | undefined, lineIndex: number) {
  return `${serialNumber || 'LOT'}/${lineIndex + 1}`
}
