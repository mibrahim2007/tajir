'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { ALL_MODULES, type ModuleKey } from '@/lib/modules'
import type { ActionResult } from '@/lib/types'

export async function updateTenantFeaturesAction(enabled: ModuleKey[]): Promise<ActionResult> {
  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const valid = enabled.filter((k) => ALL_MODULES.includes(k))

  const admin = createAdminClient()
  const { error } = await admin
    .from('tenants')
    .update({ features: valid })
    .eq('id', tenantId)

  if (error) return { success: false, error: error.message, code: 'UPDATE_ERROR' }

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'update',
    entity: 'tenants',
    entityId: tenantId,
    after: { features: valid },
  })

  return { success: true, data: undefined }
}

export async function updateMemberPermissionsAction(
  tenantUserId: string,
  permissions: ModuleKey[] | null,
): Promise<ActionResult> {
  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const valid = permissions === null ? null : permissions.filter((k) => ALL_MODULES.includes(k))

  const admin = createAdminClient()
  const { error } = await admin
    .from('tenant_users')
    .update({ permissions: valid })
    .eq('id', tenantUserId)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: error.message, code: 'UPDATE_ERROR' }

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'update',
    entity: 'tenant_users',
    entityId: tenantUserId,
    after: { permissions: valid },
  })

  return { success: true, data: undefined }
}
