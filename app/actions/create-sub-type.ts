'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  parentId: z.string().uuid('Select an item type'),
  name:     z.string().trim().min(1, 'Name is required').max(100),
})

// Adds one sub-type under an existing top-level item type, from the stock
// item's Sub Type list. The sub-type carries its parent's formula profile, the
// same way edit-item-type copies it down.
export async function createSubTypeAction(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string; parentId: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const { data: parent } = await admin
    .from('item_types')
    .select('id, formula, stock_unit, pack_unit, std_pack_weight, track_grade, track_lot')
    .eq('id', parsed.data.parentId).eq('tenant_id', tenantId).is('parent_id', null)
    .maybeSingle()
  if (!parent) return { success: false, error: 'Item type not found', code: 'NOT_FOUND' }

  const { data, error } = await admin
    .from('item_types')
    .insert({
      tenant_id:       tenantId,
      name:            parsed.data.name,
      parent_id:       parent.id,
      formula:         parent.formula,
      stock_unit:      parent.stock_unit,
      pack_unit:       parent.pack_unit,
      std_pack_weight: parent.std_pack_weight,
      track_grade:     parent.track_grade,
      track_lot:       parent.track_lot,
    })
    .select('id, name')
    .single()

  if (error || !data) {
    if (error?.code === '23505') return { success: false, error: 'An item type or sub type with this name already exists', code: 'DUPLICATE' }
    return { success: false, error: 'Failed to create sub type', code: 'INTERNAL_ERROR' }
  }
  return { success: true, data: { id: data.id, name: data.name, parentId: parent.id } }
}
