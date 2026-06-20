'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

export async function deleteLocationAction(id: string): Promise<ActionResult<null>> {
  const { user, tenantId } = await requireAuth()
  const admin = createAdminClient()

  const { error } = await admin
    .from('locations')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    const msg = error.message.includes('foreign key')
      ? 'Cannot delete location with linked transactions'
      : 'Failed to delete location'
    return { success: false, error: msg, code: 'INTERNAL_ERROR' }
  }

  await createAuditEntry({ tenantId, userId: user.id, action: 'delete', entity: 'locations', entityId: id, before: { id } })
  return { success: true, data: null }
}
