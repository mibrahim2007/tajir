'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'
import { createLotSchema, type CreateLotInput } from './inventory-lot-schema'

export async function createInventoryLotAction(
  input: CreateLotInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createLotSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, tenantId } = await requireAuth()

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { name, code, count, type, fiber, lot, defaultSupplierId, confirmDuplicateLot } = parsed.data

  const admin = createAdminClient()

  if (lot && !confirmDuplicateLot) {
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
      code: code || null,
      count,
      type: type || null,
      fiber: fiber || null,
      lot: lot || null,
      default_supplier_id: defaultSupplierId || null,
    })
    .select('id')
    .single()

  if (error || !newLot) {
    return { success: false, error: 'Failed to create stock item', code: 'INTERNAL_ERROR' }
  }

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
