import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeLotNo } from './stock-position'

// Cost per stock unit (per kg for weighed yarn, per Nos otherwise), used to
// post cost of goods sold and to value stock (migration 0073).
//
// Receipts are opening stock and purchases, less purchase returns, up to a
// date. Items whose type tracks lot and/or grade are costed from the receipts
// of that lot / grade ("specific identification"); when those have no cost, or
// the item tracks neither, the item's average receipt cost is used. Freight and
// other landed costs are not included: cost is what the supplier was paid
// (net of discount, in PKR).

export type CostReceipt = {
  stockItemId: string
  gradeId:     string | null
  lotNo:       string | null
  /** Stock units received (negative for a purchase return). */
  quantity:    number
  /** PKR value of those units (negative for a purchase return). */
  value:       number
}

export type CostQuery = {
  stockItemId: string
  gradeId?:    string | null
  lotNo?:      string | null
  trackGrade?: boolean
  trackLot?:   boolean
}

const unitCost = (rows: CostReceipt[]) => {
  const qty = rows.reduce((s, r) => s + r.quantity, 0)
  const value = rows.reduce((s, r) => s + r.value, 0)
  return qty > 1e-9 && value > 0 ? value / qty : null
}

// Pure: cost per stock unit for one line, or null when nothing has cost yet.
export function unitCostFor(
  receipts: CostReceipt[],
  q: CostQuery,
  fallbackRate?: number | null,
): number | null {
  const item = receipts.filter((r) => r.stockItemId === q.stockItemId)
  if (q.trackGrade || q.trackLot) {
    const lot = normalizeLotNo(q.lotNo)
    const own = item.filter((r) =>
      (!q.trackGrade || r.gradeId === (q.gradeId ?? null)) &&
      (!q.trackLot || r.lotNo === lot))
    const c = unitCost(own)
    if (c !== null) return c
  }
  return unitCost(item) ?? (fallbackRate && fallbackRate > 0 ? fallbackRate : null)
}

export const round2 = (n: number) => Math.round(n * 100) / 100
export const round4 = (n: number) => Math.round(n * 10000) / 10000

type Num = number | string | null

// Receipts for the given items, dated on or before `asOf` (opening stock has
// no date and always counts).
export async function loadCostReceipts(
  admin: SupabaseClient,
  tenantId: string,
  stockItemIds: string[],
  asOf?: string | null,
): Promise<{ receipts: CostReceipt[]; openingRates: Map<string, number> }> {
  const ids = [...new Set(stockItemIds.filter(Boolean))]
  if (ids.length === 0) return { receipts: [], openingRates: new Map() }

  let po = admin.from('purchase_orders')
    .select('stock_item_id, grade_id, lot_no, quantity, pkr_equivalent')
    .eq('tenant_id', tenantId).in('stock_item_id', ids)
  let pr = admin.from('purchase_returns')
    .select('stock_item_id, grade_id, lot_no, quantity, pkr_equivalent')
    .eq('tenant_id', tenantId).in('stock_item_id', ids)
  if (asOf) { po = po.lte('date', asOf); pr = pr.lte('date', asOf) }

  const [{ data: purchases }, { data: returns }, { data: opening }, { data: items }] = await Promise.all([
    po,
    pr,
    admin.from('stock_opening_balances')
      .select('stock_item_id, grade_id, lot_no, quantity, rate')
      .eq('tenant_id', tenantId).in('stock_item_id', ids),
    admin.from('inventory_lots').select('id, opening_rate').eq('tenant_id', tenantId).in('id', ids),
  ])

  type Row = { stock_item_id: string; grade_id: string | null; lot_no: string | null; quantity: Num }
  const receipts: CostReceipt[] = []
  for (const r of (purchases ?? []) as (Row & { pkr_equivalent: Num })[]) {
    receipts.push({ stockItemId: r.stock_item_id, gradeId: r.grade_id, lotNo: normalizeLotNo(r.lot_no), quantity: Number(r.quantity) || 0, value: Number(r.pkr_equivalent) || 0 })
  }
  for (const r of (returns ?? []) as (Row & { pkr_equivalent: Num })[]) {
    receipts.push({ stockItemId: r.stock_item_id, gradeId: r.grade_id, lotNo: normalizeLotNo(r.lot_no), quantity: -(Number(r.quantity) || 0), value: -(Number(r.pkr_equivalent) || 0) })
  }
  for (const r of (opening ?? []) as (Row & { rate: Num })[]) {
    const qty = Number(r.quantity) || 0
    if (qty <= 0) continue
    receipts.push({ stockItemId: r.stock_item_id, gradeId: r.grade_id, lotNo: normalizeLotNo(r.lot_no), quantity: qty, value: qty * (Number(r.rate) || 0) })
  }
  const openingRates = new Map(((items ?? []) as { id: string; opening_rate: Num }[]).map((i) => [i.id, Number(i.opening_rate) || 0]))
  return { receipts, openingRates }
}

// Cost for each line of a document; `quantity` is in stock units.
export function costLines<T extends CostQuery & { quantity: number }>(
  data: { receipts: CostReceipt[]; openingRates: Map<string, number> },
  lines: T[],
): { costRate: number | null; costAmount: number }[] {
  return lines.map((l) => {
    const rate = unitCostFor(data.receipts, l, data.openingRates.get(l.stockItemId))
    return { costRate: rate === null ? null : round4(rate), costAmount: rate === null ? 0 : round2(rate * l.quantity) }
  })
}
