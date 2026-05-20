'use server'

import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { db } from '@/db'
import { inventoryLots } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  id:    z.string().uuid(),
  name:  z.string().min(1, 'Name is required'),
  code:  z.string().optional(),
  count: z.string().min(1, 'Count is required'),
  type:  z.enum(['combed', 'carded']),
  fiber: z.string().min(1, 'Fiber is required'),
  lot:   z.string().optional(),
})

export async function editInventoryLotAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, name, code, count, type, fiber, lot } = parsed.data

  const existing = await db.select().from(inventoryLots).where(and(eq(inventoryLots.id, id), eq(inventoryLots.tenantId, tenantId))).limit(1).then((r) => r[0] ?? null)
  if (!existing) return { success: false, error: 'Stock item not found', code: 'NOT_FOUND' }

  await db.update(inventoryLots).set({ name, code: code ?? null, count, type, fiber, lot: lot ?? null })
    .where(and(eq(inventoryLots.id, id), eq(inventoryLots.tenantId, tenantId)))

  await createAuditEntry({ tenantId, userId: user.id, action: 'update', entity: 'inventory_lots', entityId: id, before: { name: existing.name, count: existing.count, type: existing.type, fiber: existing.fiber, lot: existing.lot }, after: { name, count, type, fiber, lot } })

  return { success: true, data: undefined }
}
