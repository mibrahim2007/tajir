// Splits a period's net profit (or loss) across owners by their share %.
//
// The LAST owner absorbs the rounding remainder so the allocation always sums
// back to the net profit exactly — the same idiom as the loan amortization
// schedule in `lib/loans/amortization.ts`.
//
// Losses are allocated identically with a negative `netProfit`, which reverses
// the GL direction (DR Owner's Capital / CR Retained Earnings).

import { round2 } from '@/lib/loans/amortization'

export type OwnerShare = {
  ownerId: string
  name: string
  sharePct: number
}

export type AllocationRow = {
  ownerId: string
  name: string
  sharePct: number
  amount: number
}

// Shares must total 100% (within a cent's worth of tolerance) or the profit
// would be only partly distributed, silently stranding the remainder.
export const SHARE_TOLERANCE = 0.01

export function totalShare(owners: OwnerShare[]): number {
  return round2(owners.reduce((s, o) => s + o.sharePct, 0))
}

export function sharesAreComplete(owners: OwnerShare[]): boolean {
  return owners.length > 0 && Math.abs(totalShare(owners) - 100) <= SHARE_TOLERANCE
}

export function allocateProfit(netProfit: number, owners: OwnerShare[]): AllocationRow[] {
  if (owners.length === 0) return []

  const total = totalShare(owners)
  if (total <= 0) return []

  const rows: AllocationRow[] = []
  let allocated = 0
  for (let i = 0; i < owners.length; i++) {
    const o = owners[i]
    const isLast = i === owners.length - 1
    // Divide by the actual total rather than a hard 100 so a caller that has
    // deliberately bypassed the completeness check still distributes the whole
    // amount instead of leaving a silent remainder.
    const amount = isLast ? round2(netProfit - allocated) : round2((netProfit * o.sharePct) / total)
    allocated = round2(allocated + amount)
    rows.push({ ownerId: o.ownerId, name: o.name, sharePct: o.sharePct, amount })
  }
  return rows
}
