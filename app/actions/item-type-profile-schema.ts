import { z } from 'zod'
import { ITEM_FORMULAS } from '@/lib/item-formula'

const blankToNull = (v: unknown) =>
  v === '' || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? null : v

// The formula profile of an item type (migration 0071), shared by the create
// and edit item-type actions and the quick-add dialog.
export const itemTypeProfileSchema = z.object({
  formula:       z.enum(ITEM_FORMULAS),
  stockUnit:     z.preprocess(blankToNull, z.string().trim().max(30).nullable()).default(null),
  packUnit:      z.preprocess(blankToNull, z.string().trim().max(30).nullable()).default(null),
  stdPackWeight: z.preprocess(blankToNull, z.coerce.number().positive('Weight per pack must be more than 0').nullable()).default(null),
  trackGrade:    z.boolean().default(false),
  trackLot:      z.boolean().default(false),
})

export type ItemTypeProfileInput = z.infer<typeof itemTypeProfileSchema>

// Column values for item_types. Pack fields only apply to carton formulas.
export function profileColumns(p: ItemTypeProfileInput) {
  const packed = p.formula === 'per_lb' || p.formula === 'per_kg' || p.formula === 'per_pack'
  return {
    formula:         p.formula,
    stock_unit:      p.stockUnit,
    pack_unit:       packed ? p.packUnit : null,
    std_pack_weight: packed ? p.stdPackWeight : null,
    track_grade:     p.trackGrade,
    track_lot:       p.trackLot,
  }
}
