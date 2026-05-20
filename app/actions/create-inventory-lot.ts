'use server'

import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { db } from '@/db'
import { inventoryLots } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'
import type { InventoryLot } from '@/db/schema'

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

export async function createInventoryLotAction(
  input: CreateLotInput,
): Promise<ActionResult<InventoryLot>> {
  const parsed = createLotSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, tenantId } = await requireAuth()

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { name, code, count, type, fiber, lot, defaultSupplierId, confirmDuplicateLot } =
    parsed.data

  if (lot && !confirmDuplicateLot) {
    const duplicate = await db
      .select({ id: inventoryLots.id })
      .from(inventoryLots)
      .where(and(eq(inventoryLots.tenantId, tenantId), eq(inventoryLots.lot, lot)))
      .limit(1)
      .then((rows) => rows[0] ?? null)

    if (duplicate) {
      return { success: false, error: 'Lot already exists on another item', code: 'LOT_DUPLICATE' }
    }
  }

  const [newLot] = await db
    .insert(inventoryLots)
    .values({
      tenantId,
      name,
      code: code || null,
      count,
      type: type || null,
      fiber: fiber || null,
      lot: lot || null,
      defaultSupplierId: defaultSupplierId || null,
    })
    .returning()

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'create',
    entity: 'inventory_lots',
    entityId: newLot.id,
    after: { name, count, type, fiber, lot },
  })

  return { success: true, data: newLot }
}
