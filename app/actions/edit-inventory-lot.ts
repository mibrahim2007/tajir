'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  id:         z.string().uuid(),
  name:       z.string().min(1, 'Name is required'),
  code:       z.string().optional(),
  count:      z.string().min(1, 'Count is required'),
  itemTypeId: z.string().uuid().optional(),
  fiber:      z.string().optional(),
  lot:        z.string().optional(),
})

export async function editInventoryLotAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, name, code, count, itemTypeId, fiber, lot } = parsed.data

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('inventory_lots')
    .select('name, count, item_type_id, fiber, lot')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!existing) return { success: false, error: 'Stock item not found', code: 'NOT_FOUND' }

  const { error } = await admin
    .from('inventory_lots')
    .update({ name, code: code ?? null, count, item_type_id: itemTypeId ?? null, fiber: fiber ?? null, lot: lot ?? null })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update stock item', code: 'INTERNAL_ERROR' }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'update', entity: 'inventory_lots', entityId: id,
    before: { name: existing.name, count: existing.count, itemTypeId: existing.item_type_id, fiber: existing.fiber, lot: existing.lot },
    after:  { name, count, itemTypeId, fiber, lot },
  })

  return { success: true, data: undefined }
}
