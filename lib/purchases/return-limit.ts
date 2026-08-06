// How much of a purchase order is still returnable.
//
// The stock-on-hand check that used to be the only guard asks a different
// question — "is there enough of this item to remove" — which says nothing
// about the order being returned against. So the same PO could be returned
// twice, or returned for more than it ever contained, whenever other stock of
// that item happened to be on hand. PO-2026-0016 reached 28,000 returned
// against a 15,000 purchase that way, which is what pushed a supplier's return
// rate above 100%.
//
// Kept pure so the arithmetic is checkable without a database.

export type ReturnLimit =
  | { ok: true; remaining: number }
  | { ok: false; remaining: number; reason: 'fully_returned' | 'exceeds_remaining' }

/**
 * Whether `quantity` may still be returned against a purchase order.
 *
 * Equality is allowed — returning exactly what is left is normal, and is how a
 * wholly rejected delivery is recorded.
 */
export function checkReturnLimit(opts: {
  purchased: number
  alreadyReturned: number
  quantity: number
}): ReturnLimit {
  const purchased = Number(opts.purchased) || 0
  const alreadyReturned = Number(opts.alreadyReturned) || 0
  const quantity = Number(opts.quantity) || 0

  // Never report a negative headroom: an order already over-returned by bad
  // historical data has nothing left, not "minus 13,000" left.
  const remaining = Math.max(0, purchased - alreadyReturned)

  if (remaining <= 0) return { ok: false, remaining: 0, reason: 'fully_returned' }
  if (quantity > remaining) return { ok: false, remaining, reason: 'exceeds_remaining' }
  return { ok: true, remaining }
}
