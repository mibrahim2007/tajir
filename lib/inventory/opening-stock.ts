// Opening stock maths, kept free of Supabase so it can be checked directly
// (`npm run check:opening-stock`) rather than only through a live database.
//
// An item's opening quantity is split across the warehouses that held it on
// day one — one `stock_opening_balances` row per location. Everything that
// follows exists to keep `inventory_lots` consistent with those rows.

/** One warehouse's share of an item's opening stock. */
export type OpeningStockLine = { locationId: string; quantity: number; rate: number }

export type OpeningStockPlan = {
  /** Lines worth storing — a location with nothing at it is simply absent. */
  lines: OpeningStockLine[]
  /** Locations that had a row before and no longer do. */
  removedLocationIds: string[]
  /** Sum of the stored lines. */
  openingTotal: number
  /** What `inventory_lots.current_quantity` becomes. */
  currentQuantity: number
  /** What `inventory_lots.opening_rate` becomes. */
  openingRate: number
  /** What the legacy `inventory_lots.location_id` becomes. */
  primaryLocationId: string | null
}

export type OpeningStockResult =
  | { ok: true; plan: OpeningStockPlan }
  | { ok: false; error: string }

/** Trims float drift so a value fits its column's scale. */
export function round(value: number, decimals: number) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * Works out how a new set of per-location opening lines lands on the item.
 *
 * `current_quantity` is a RUNNING total: opening baseline plus every movement
 * since. So it moves by the difference between the old and new opening totals
 * rather than being overwritten — otherwise re-saving an opening balance would
 * silently erase the purchases and sales posted after it was first entered.
 */
export function planOpeningStock(args: {
  currentQuantity: number
  /** The item's opening rows as they stand now. */
  existing: { locationId: string; quantity: number }[]
  /** The lines the user just submitted. */
  lines: OpeningStockLine[]
}): OpeningStockResult {
  // A location carrying neither quantity nor rate holds no information; drop
  // it, which is also how a line gets removed (the user zeroes it out).
  const lines = args.lines.filter((l) => l.quantity > 0 || l.rate > 0)

  const kept = new Set<string>()
  for (const line of lines) {
    if (kept.has(line.locationId)) return { ok: false, error: 'Each location can only be listed once' }
    kept.add(line.locationId)
  }

  const oldTotal = args.existing.reduce((sum, r) => sum + r.quantity, 0)
  const openingTotal = round(lines.reduce((sum, l) => sum + l.quantity, 0), 3)
  const currentQuantity = round(args.currentQuantity - oldTotal + openingTotal, 3)

  // current_quantity carries a NOT NULL >= 0 check. Landing below zero means
  // the item has already been sold down past the opening being entered.
  if (currentQuantity < 0) {
    return {
      ok: false,
      error: 'That opening quantity is lower than what has already been sold or transferred out of this item',
    }
  }

  // The item-level rate is what stock valuation falls back to when the item has
  // never been purchased, so it has to be the weighted average of the lines —
  // any single line's rate would misvalue the rest.
  const openingRate = openingTotal > 0
    ? round(lines.reduce((sum, l) => sum + l.quantity * l.rate, 0) / openingTotal, 4)
    : round(Math.max(0, ...lines.map((l) => l.rate)), 4)

  const primaryLocationId = lines.length > 0
    ? lines.reduce((best, l) => (l.quantity > best.quantity ? l : best), lines[0]).locationId
    : null

  return {
    ok: true,
    plan: {
      lines,
      removedLocationIds: args.existing.map((r) => r.locationId).filter((id) => !kept.has(id)),
      openingTotal,
      currentQuantity,
      openingRate,
      primaryLocationId,
    },
  }
}
