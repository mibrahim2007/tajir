// Below-cost flag for a saved sale line, used by the internal sales views.
//
// The line's own cost_amount (0073) is used when it was saved with one;
// lines posted before that fall back to an estimated cost per stock unit
// (e.g. the latest purchase's PKR value ÷ its quantity). Either way the
// comparison is AMOUNT vs cost × quantity in stock units, so a line billed per
// lb against stock kept in kg is compared like for like.

export type SavedSaleLine = {
  stock_item_id: string
  quantity: number
  pkr_equivalent: number
  cost_amount?: number | null
}

export function saleLineCost(line: SavedSaleLine, legacyUnitCost?: Record<string, number>): number | null {
  if (line.cost_amount != null && Number(line.cost_amount) > 0) return Number(line.cost_amount)
  const unit = legacyUnitCost?.[line.stock_item_id]
  return unit !== undefined && unit > 0 ? unit * line.quantity : null
}

export function isSaleLineBelowCost(line: SavedSaleLine, legacyUnitCost?: Record<string, number>): boolean {
  const cost = saleLineCost(line, legacyUnitCost)
  return cost !== null && line.pkr_equivalent < cost - 0.005
}

// Cost per stock unit of the line (for "Below cost (Rs …)" captions).
export function saleLineUnitCost(line: SavedSaleLine, legacyUnitCost?: Record<string, number>): number | null {
  const cost = saleLineCost(line, legacyUnitCost)
  return cost !== null && line.quantity > 0 ? cost / line.quantity : null
}
