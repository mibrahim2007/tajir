'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

export async function deleteInventoryLotAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id } = parsed.data

  const admin = createAdminClient()

  const { data: lot } = await admin
    .from('inventory_lots')
    .select('name, count, fiber, current_quantity')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!lot) return { success: false, error: 'Stock item not found', code: 'NOT_FOUND' }

  const { error } = await admin
    .from('inventory_lots')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to delete stock item', code: 'INTERNAL_ERROR' }

  await createAuditEntry({ tenantId, userId: user.id, action: 'delete', entity: 'inventory_lots', entityId: id, before: { name: lot.name, count: lot.count, fiber: lot.fiber, currentQuantity: lot.current_quantity } })

  return { success: true, data: undefined }
}
