'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'
import { parseCount } from '@/lib/parse-count'
import { createLotSchema, type CreateLotInput } from './inventory-lot-schema'

export async function createInventoryLotAction(
  input: CreateLotInput,
): Promise<ActionResult<{ id: string; sku: string }>> {
  const parsed = createLotSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, tenantId } = await requireAuth()

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { name, itemNature, sku, code, count, unitOfMeasure, itemTypeId, fiber, lot, defaultSupplierId, confirmDuplicateLot } = parsed.data
  const isService = itemNature === 'service'

  const admin = createAdminClient()

  // Service items carry no lot number, so the duplicate-lot guard only applies
  // to stockable inventory items.
  if (!isService && lot && !confirmDuplicateLot) {
    const { data: existing } = await admin
      .from('inventory_lots')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('lot', lot)
      .limit(1)
      .single()

    if (existing) {
      return { success: false, error: 'Lot already exists on another item', code: 'LOT_DUPLICATE' }
    }
  }

  const { data: newLot, error } = await admin
    .from('inventory_lots')
    .insert({
      tenant_id: tenantId,
      name,
      item_nature: itemNature,
      // Omit sku when blank so the DB default auto-mints the next TJR-NNNNNN.
      ...(sku ? { sku } : {}),
      code: code || null,
      // Service items are non-stockable: drop textile/stock attributes.
      count: isService ? null : parseCount(count),
      unit_of_measure: unitOfMeasure || null,
      item_type_id: itemTypeId || null,
      fiber: isService ? null : (fiber || null),
      lot: isService ? null : (lot || null),
      default_supplier_id: isService ? null : (defaultSupplierId || null),
    })
    .select('id, sku')
    .single()

  if (error || !newLot) {
    // A user-supplied SKU that collides with an existing one surfaces clearly.
    if (error?.code === '23505' && sku) {
      return { success: false, error: `SKU "${sku}" is already in use`, code: 'SKU_DUPLICATE' }
    }
    return { success: false, error: 'Failed to create stock item', code: 'INTERNAL_ERROR' }
  }

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'create',
    entity: 'inventory_lots',
    entityId: newLot.id,
    after: { name, itemNature, count, unitOfMeasure, itemTypeId, fiber, lot },
  })

  return { success: true, data: newLot }
}
