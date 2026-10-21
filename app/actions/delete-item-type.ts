'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

export async function deleteItemTypeAction(id: string): Promise<ActionResult<void>> {
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const admin = createAdminClient()

  // Every stock item needs a type (0071), so a type still in use — directly or
  // through one of its sub-types — can't be deleted.
  const { data: subs } = await admin.from('item_types').select('id').eq('tenant_id', tenantId).eq('parent_id', id)
  const familyIds = [id, ...(subs ?? []).map((r) => r.id)]
  const { count } = await admin
    .from('inventory_lots').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('item_type_id', familyIds)
  if ((count ?? 0) > 0) {
    return {
      success: false,
      error: `${count} stock item${count === 1 ? ' uses' : 's use'} this type. Move them to another type first.`,
      code: 'IN_USE',
    }
  }

  const { error } = await admin
    .from('item_types')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to delete item type', code: 'INTERNAL_ERROR' }
  return { success: true, data: undefined }
}
