import { z } from 'zod'

const itemSchema = z.object({
  name:          z.string().min(1, 'Name is required'),
  code:          z.string().optional(),
  count:         z.string().optional(),
  unitOfMeasure: z.string().optional(),
  fiber:         z.string().optional(),
  lot:           z.string().optional(),
})

export const batchLotsSchema = z.object({
  itemTypeId: z.string().uuid('Choose an item type first'),
  items:      z.array(itemSchema).min(1, 'Add at least one item').max(100, 'You can add up to 100 items at once'),
})

export type BatchLotsInput = z.infer<typeof batchLotsSchema>
