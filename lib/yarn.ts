// Yarn line-item helpers, shared by the trading forms, server actions and prints.
//
// A line shows the three yarn fields (Yarn Type, Yarn Weight, Multiply By) only
// when its selected item's Item Type is named "Yarn". `multiplyBy` scales the
// line's monetary amount; it defaults to 1 so non-yarn lines are unaffected.

export const YARN_TYPES = ['Cotton', 'Polyester', 'Viscose', 'Blended'] as const
export type YarnType = (typeof YARN_TYPES)[number]

// True when an item's Item Type name marks it as yarn (case-insensitive).
export function isYarnItemType(itemTypeName?: string | null): boolean {
  return (itemTypeName ?? '').trim().toLowerCase() === 'yarn'
}

// Normalise a multiplier to a positive number, defaulting to 1 (no-op).
export function normalizeMultiplyBy(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 1
}
