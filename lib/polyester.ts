// Polyester line-item helpers, shared by the trading forms, server actions and
// prints.
//
// When a line's selected item's Item Type is a Polyester type, the line exposes
// three extra fields: Nos_Carton (cartons), Weight/Carton (kg) and the derived
// QTY LBS. The line amount uses QTY LBS instead of the plain quantity
// (amount = qtyLbs * rate). The plain `quantity` still drives inventory stock.

// kg → lbs conversion divisor used by the QTY LBS formula.
export const LBS_PER_KG = 2.2046

// True when an item's Item Type name marks it as polyester (case-insensitive,
// substring — covers types like "150D Polyester", "150/144 Polyester").
export function isPolyesterItemType(itemTypeName?: string | null): boolean {
  return (itemTypeName ?? '').trim().toLowerCase().includes('polyester')
}

// QTY LBS = Nos_Carton * Weight-per-carton / 2.2046. Returns 0 for blanks.
export function computeQtyLbs(nosCarton: unknown, weightPerCarton: unknown): number {
  const cartons = Number(nosCarton)
  const weight = Number(weightPerCarton)
  if (!Number.isFinite(cartons) || !Number.isFinite(weight)) return 0
  return (cartons * weight) / LBS_PER_KG
}
