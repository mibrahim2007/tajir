'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'
import { parseCount } from '@/lib/parse-count'
import { batchLotsSchema, type BatchLotsInput } from './inventory-lots-batch-schema'

export async function createInventoryLotsBatchAction(
  input: BatchLotsInput,
): Promise<ActionResult<{ created: number }>> {
  const parsed = batchLotsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, tenantId } = await requireAuth()

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { itemTypeId, items } = parsed.data
  const admin = createAdminClient()

  // Confirm the item type belongs to this tenant.
  const { data: itemType } = await admin
    .from('item_types')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', itemTypeId)
    .maybeSingle()
  if (!itemType) {
    return { success: false, error: 'Selected item type was not found', code: 'ITEM_TYPE_NOT_FOUND' }
  }

  const trimmed = items.map((it) => ({ ...it, name: it.name.trim() }))

  // Catch duplicate names within the batch itself (unique tenant+name constraint).
  const seen = new Set<string>()
  for (const it of trimmed) {
    const key = it.name.toLowerCase()
    if (seen.has(key)) {
      return { success: false, error: `Duplicate name "${it.name}" in this batch`, code: 'DUPLICATE_IN_BATCH' }
    }
    seen.add(key)
  }

  const rows = trimmed.map((it) => ({
    tenant_id: tenantId,
    name: it.name,
    // Omit sku so the DB default auto-mints the next TJR-NNNNNN per row.
    code: it.code?.trim() || null,
    // `count` is a numeric column; keep only a valid number, otherwise null.
    count: parseCount(it.count),
    unit_of_measure: it.unitOfMeasure?.trim() || null,
    item_type_id: itemTypeId,
    fiber: it.fiber?.trim() || null,
    lot: it.lot?.trim() || null,
  }))

  const { data: created, error } = await admin
    .from('inventory_lots')
    .insert(rows)
    .select('id, name')

  if (error || !created) {
    if (error?.code === '23505') {
      return {
        success: false,
        error: 'One or more item names already exist. Please use unique names.',
        code: 'NAME_DUPLICATE',
      }
    }
    return { success: false, error: 'Failed to create items', code: 'INTERNAL_ERROR' }
  }

  await Promise.all(
    created.map((row) =>
      createAuditEntry({
        tenantId,
        userId: user.id,
        action: 'create',
        entity: 'inventory_lots',
        entityId: row.id,
        after: { name: row.name, itemTypeId },
      }),
    ),
  )

  return { success: true, data: { created: created.length } }
}
