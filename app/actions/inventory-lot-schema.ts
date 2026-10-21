import { z } from 'zod'

export const createLotSchema = z.object({
  name:               z.string().min(1, 'Name is required'),
  itemNature:         z.enum(['inventory', 'service']),
  sku:                z.string().trim().max(64, 'SKU too long').optional(),
  code:               z.string().optional(),
  count:              z.string().optional(),
  unitOfMeasure:      z.string().optional(),
  // Mandatory: the item type's formula decides how the item's lines are billed.
  itemTypeId:         z.string({ error: 'Item type is required' }).uuid('Item type is required'),
  fiber:              z.string().optional(),
  lot:                z.string().optional(),
  defaultSupplierId:  z.string().uuid().optional(),
  confirmDuplicateLot: z.boolean().optional(),
})

export type CreateLotInput = z.infer<typeof createLotSchema>
