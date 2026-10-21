'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'
import { itemTypeProfileSchema, profileColumns } from './item-type-profile-schema'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  // Optional sub-types created as children of this type.
  subTypes: z.array(z.string().max(100)).optional().default([]),
}).merge(itemTypeProfileSchema)

// Also used by the "+ Add item type" option in the stock-item type list, so it
// returns the new type's formula for the caller to use straight away.
export async function createItemTypeAction(input: unknown): Promise<ActionResult<{ id: string; name: string; formula: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('item_types')
    .insert({ tenant_id: tenantId, name: parsed.data.name.trim(), ...profileColumns(parsed.data) })
    .select('id, name, formula')
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'An item type with this name already exists', code: 'DUPLICATE' }
    return { success: false, error: 'Failed to create item type', code: 'INTERNAL_ERROR' }
  }

  // De-duplicated, non-empty sub-type names become child rows, carrying the
  // parent's profile.
  const subs = [...new Set(parsed.data.subTypes.map((s) => s.trim()).filter(Boolean))]
  if (subs.length > 0) {
    const { error: subErr } = await admin
      .from('item_types')
      .insert(subs.map((name) => ({ tenant_id: tenantId, name, parent_id: data!.id, ...profileColumns(parsed.data) })))
    if (subErr) {
      if (subErr.code === '23505') return { success: false, error: 'A sub-type name is already used by another item type', code: 'DUPLICATE' }
      return { success: false, error: 'Item type created, but its sub-types could not be saved', code: 'INTERNAL_ERROR' }
    }
  }

  return { success: true, data: data! }
}
