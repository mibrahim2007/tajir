import { z } from 'zod'

export const createLotSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  count: z.string().min(1, 'Count is required'),
  type: z.enum(['Combed', 'Carded']).optional(),
  fiber: z.string().optional(),
  lot: z.string().optional(),
  defaultSupplierId: z.string().uuid().optional(),
  confirmDuplicateLot: z.boolean().optional(),
})

export type CreateLotInput = z.infer<typeof createLotSchema>
