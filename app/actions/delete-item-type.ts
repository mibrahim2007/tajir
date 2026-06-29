'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

export async function deleteItemTypeAction(id: string): Promise<ActionResult<void>> {
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('item_types')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to delete item type', code: 'INTERNAL_ERROR' }
  return { success: true, data: undefined }
}
