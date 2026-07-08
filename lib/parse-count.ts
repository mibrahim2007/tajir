// `inventory_lots.count` is a numeric column. Forms collect it as a free-text
// string, so coerce to a finite number or null before writing to the DB. This
// prevents "invalid input syntax for type numeric" errors on non-numeric input.
export function parseCount(value: string | null | undefined): number | null {
  const raw = value?.trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}
