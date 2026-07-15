'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  id:   z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(100),
  // Desired sub-types after the edit. Existing ones carry their id; new ones omit
  // it. Any current child not listed here is removed.
  subTypes: z.array(z.object({
    id:   z.string().uuid().optional(),
    name: z.string().max(100),
  })).optional().default([]),
})

export async function editItemTypeAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const admin = createAdminClient()
  const { id } = parsed.data

  const { error } = await admin
    .from('item_types')
    .update({ name: parsed.data.name.trim() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('parent_id', null)

  if (error) {
    if (error.code === '23505') return { success: false, error: 'An item type with this name already exists', code: 'DUPLICATE' }
    return { success: false, error: 'Failed to update item type', code: 'INTERNAL_ERROR' }
  }

  // Reconcile children: rename kept ones, insert new ones, delete removed ones.
  const desired = parsed.data.subTypes
    .map((s) => ({ id: s.id, name: s.name.trim() }))
    .filter((s) => s.name.length > 0)

  const { data: existing } = await admin
    .from('item_types').select('id').eq('tenant_id', tenantId).eq('parent_id', id)
  const existingIds = new Set((existing ?? []).map((r) => r.id))
  const keptIds = new Set(desired.map((s) => s.id).filter(Boolean) as string[])

  // Delete children that are no longer desired (their items are unlinked via
  // inventory_lots.item_type_id ON DELETE SET NULL).
  const toDelete = [...existingIds].filter((cid) => !keptIds.has(cid))
  if (toDelete.length > 0) {
    await admin.from('item_types').delete().in('id', toDelete).eq('tenant_id', tenantId)
  }

  // Rename existing children.
  for (const s of desired) {
    if (s.id && existingIds.has(s.id)) {
      const { error: upErr } = await admin
        .from('item_types').update({ name: s.name }).eq('id', s.id).eq('tenant_id', tenantId)
      if (upErr) {
        if (upErr.code === '23505') return { success: false, error: `Sub-type name "${s.name}" is already used`, code: 'DUPLICATE' }
        return { success: false, error: 'Failed to update a sub-type', code: 'INTERNAL_ERROR' }
      }
    }
  }

  // Insert new children (de-duplicated by name).
  const newNames = [...new Set(desired.filter((s) => !s.id).map((s) => s.name))]
  if (newNames.length > 0) {
    const { error: insErr } = await admin
      .from('item_types').insert(newNames.map((name) => ({ tenant_id: tenantId, name, parent_id: id })))
    if (insErr) {
      if (insErr.code === '23505') return { success: false, error: 'A sub-type name is already used by another item type', code: 'DUPLICATE' }
      return { success: false, error: 'Failed to add a sub-type', code: 'INTERNAL_ERROR' }
    }
  }

  return { success: true, data: undefined }
}
