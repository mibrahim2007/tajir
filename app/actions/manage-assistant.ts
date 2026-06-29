'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => chars[b % chars.length]).join('')
}

async function getActiveAssistant(tenantId: string, admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin
    .from('tenant_users')
    .select('id, user_id')
    .eq('tenant_id', tenantId)
    .eq('role', 'assistant')
    .limit(1)
    .single()
  return data ?? null
}

export async function resetAssistantPasswordAction(): Promise<ActionResult<{ tempPassword: string }>> {
  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked')
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const admin = createAdminClient()
  const assistant = await getActiveAssistant(tenantId, admin)
  if (!assistant) return { success: false, error: 'No assistant found', code: 'NOT_FOUND' }

  const tempPassword = generateTempPassword()

  const { error } = await admin.auth.admin.updateUserById(assistant.user_id, {
    password: tempPassword,
  })

  if (error) return { success: false, error: error.message, code: 'UPDATE_ERROR' }

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'reset_assistant_password',
    entity: 'tenant_users',
    entityId: assistant.user_id,
  })

  return { success: true, data: { tempPassword } }
}

export async function deactivateAssistantAction(): Promise<ActionResult> {
  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const admin = createAdminClient()
  const assistant = await getActiveAssistant(tenantId, admin)
  if (!assistant) return { success: false, error: 'No assistant found', code: 'NOT_FOUND' }

  const { error: banError } = await admin.auth.admin.updateUserById(assistant.user_id, {
    ban_duration: '876600h',
  })
  if (banError) return { success: false, error: banError.message, code: 'BAN_ERROR' }

  await admin
    .from('tenant_users')
    .update({ is_active: false })
    .eq('id', assistant.id)

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'deactivate_assistant',
    entity: 'tenant_users',
    entityId: assistant.user_id,
    before: { isActive: true },
    after: { isActive: false },
  })

  return { success: true, data: undefined }
}

export async function reactivateAssistantAction(): Promise<ActionResult> {
  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const admin = createAdminClient()
  const assistant = await getActiveAssistant(tenantId, admin)
  if (!assistant) return { success: false, error: 'No assistant found', code: 'NOT_FOUND' }

  const { error: unbanError } = await admin.auth.admin.updateUserById(assistant.user_id, {
    ban_duration: 'none',
  })
  if (unbanError) return { success: false, error: unbanError.message, code: 'UNBAN_ERROR' }

  await admin
    .from('tenant_users')
    .update({ is_active: true })
    .eq('id', assistant.id)

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'reactivate_assistant',
    entity: 'tenant_users',
    entityId: assistant.user_id,
    before: { isActive: false },
    after: { isActive: true },
  })

  return { success: true, data: undefined }
}
