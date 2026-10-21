'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'
import { parseCount } from '@/lib/parse-count'

const schema = z.object({
  id:            z.string().uuid(),
  name:          z.string().min(1, 'Name is required'),
  sku:           z.string().trim().min(1, 'SKU is required').max(64, 'SKU too long'),
  code:          z.string().optional(),
  count:         z.string().optional(),
  unitOfMeasure: z.string().optional(),
  itemTypeId:    z.string({ error: 'Item type is required' }).uuid('Item type is required'),
  fiber:         z.string().optional(),
  lot:           z.string().optional(),
})

export async function editInventoryLotAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, name, sku, code, count, unitOfMeasure, itemTypeId, fiber, lot } = parsed.data

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('inventory_lots')
    .select('name, sku, count, unit_of_measure, item_type_id, fiber, lot')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!existing) return { success: false, error: 'Stock item not found', code: 'NOT_FOUND' }

  // Fiber now carries the sub type's name; an item left on a top-level type
  // (from before sub types were mandatory) keeps what it had.
  let subTypeName: string | null = null
  if (itemTypeId !== existing.item_type_id) {
    const { data: types } = await admin
      .from('item_types').select('id, name, parent_id').eq('tenant_id', tenantId).eq('id', itemTypeId)
    const next = types?.find((t) => t.id === itemTypeId)
    if (!next) return { success: false, error: 'Sub type not found', code: 'VALIDATION_ERROR' }
    // Moving to another type must land on a sub type.
    if (!next.parent_id) return { success: false, error: 'Select a sub type', code: 'VALIDATION_ERROR' }
    subTypeName = next.name
  }

  if (subTypeName === null) {
    const { data: current } = await admin
      .from('item_types').select('name, parent_id').eq('id', itemTypeId).eq('tenant_id', tenantId).maybeSingle()
    if (current?.parent_id) subTypeName = current.name
  }

  const { error } = await admin
    .from('inventory_lots')
    .update({ name, sku, code: code ?? null, count: parseCount(count), unit_of_measure: unitOfMeasure ?? null, item_type_id: itemTypeId, fiber: subTypeName ?? fiber ?? existing.fiber ?? null, lot: lot ?? null })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    if (error.code === '23505') return { success: false, error: `SKU "${sku}" is already in use`, code: 'SKU_DUPLICATE' }
    return { success: false, error: 'Failed to update stock item', code: 'INTERNAL_ERROR' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'update', entity: 'inventory_lots', entityId: id,
    before: { name: existing.name, sku: existing.sku, count: existing.count, unitOfMeasure: existing.unit_of_measure, itemTypeId: existing.item_type_id, fiber: existing.fiber, lot: existing.lot },
    after:  { name, sku, count, unitOfMeasure, itemTypeId, fiber, lot },
  })

  return { success: true, data: undefined }
}
