// QTY LBS helper for the "per_lb" item-type formula (lib/item-formula.ts):
// a line takes Nos_Carton (cartons) and Weight/Carton (kg), and its amount uses
// the derived QTY LBS instead of the plain quantity (amount = qtyLbs * rate).
// The plain `quantity` (cartons × kg) still drives inventory stock.

// kg → lbs conversion divisor used by the QTY LBS formula.
export const LBS_PER_KG = 2.2046

// QTY LBS = Nos_Carton * Weight-per-carton / 2.2046. Returns 0 for blanks.
export function computeQtyLbs(nosCarton: unknown, weightPerCarton: unknown): number {
  const cartons = Number(nosCarton)
  const weight = Number(weightPerCarton)
  if (!Number.isFinite(cartons) || !Number.isFinite(weight)) return 0
  return (cartons * weight) / LBS_PER_KG
}
