'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'
import type { Role } from '@/db/schema'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => chars[b % chars.length]).join('')
}

async function getTeamMember(tenantId: string, tenantUserId: string, admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin
    .from('tenant_users')
    .select('id, user_id, role')
    .eq('id', tenantUserId)
    .eq('tenant_id', tenantId)
    .single()
  return data ?? null
}

export async function resetMemberPasswordAction(
  tenantUserId: string,
): Promise<ActionResult<{ tempPassword: string }>> {
  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked')
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const admin = createAdminClient()
  const member = await getTeamMember(tenantId, tenantUserId, admin)
  if (!member) return { success: false, error: 'Team member not found', code: 'NOT_FOUND' }

  const tempPassword = generateTempPassword()
  const { error } = await admin.auth.admin.updateUserById(member.user_id, { password: tempPassword })
  if (error) return { success: false, error: error.message, code: 'UPDATE_ERROR' }

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'reset_assistant_password',
    entity: 'tenant_users',
    entityId: member.user_id,
  })

  return { success: true, data: { tempPassword } }
}

export async function deactivateMemberAction(tenantUserId: string): Promise<ActionResult> {
  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const admin = createAdminClient()
  const member = await getTeamMember(tenantId, tenantUserId, admin)
  if (!member) return { success: false, error: 'Team member not found', code: 'NOT_FOUND' }

  if (member.user_id === user.id)
    return { success: false, error: 'You cannot deactivate your own account', code: 'SELF_ACTION' }

  const { error: banError } = await admin.auth.admin.updateUserById(member.user_id, {
    ban_duration: '876600h',
  })
  if (banError) return { success: false, error: banError.message, code: 'BAN_ERROR' }

  await admin.from('tenant_users').update({ is_active: false }).eq('id', tenantUserId)

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'deactivate_assistant',
    entity: 'tenant_users',
    entityId: member.user_id,
    before: { isActive: true },
    after: { isActive: false },
  })

  return { success: true, data: undefined }
}

export async function reactivateMemberAction(tenantUserId: string): Promise<ActionResult> {
  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const admin = createAdminClient()
  const member = await getTeamMember(tenantId, tenantUserId, admin)
  if (!member) return { success: false, error: 'Team member not found', code: 'NOT_FOUND' }

  const { error: unbanError } = await admin.auth.admin.updateUserById(member.user_id, {
    ban_duration: 'none',
  })
  if (unbanError) return { success: false, error: unbanError.message, code: 'UNBAN_ERROR' }

  await admin.from('tenant_users').update({ is_active: true }).eq('id', tenantUserId)

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'reactivate_assistant',
    entity: 'tenant_users',
    entityId: member.user_id,
    before: { isActive: false },
    after: { isActive: true },
  })

  return { success: true, data: undefined }
}

export async function changeRoleAction(tenantUserId: string, newRole: Role): Promise<ActionResult> {
  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const admin = createAdminClient()
  const member = await getTeamMember(tenantId, tenantUserId, admin)
  if (!member) return { success: false, error: 'Team member not found', code: 'NOT_FOUND' }

  if (member.role === newRole) return { success: true, data: undefined }

  // Prevent demoting the last owner
  if (newRole !== 'owner' && member.user_id === user.id) {
    const { data: owners } = await admin
      .from('tenant_users')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('role', 'owner')
    if ((owners ?? []).length <= 1)
      return { success: false, error: 'Cannot remove the only owner', code: 'LAST_OWNER' }
  }

  await admin.from('tenant_users').update({ role: newRole }).eq('id', tenantUserId)

  await admin.auth.admin.updateUserById(member.user_id, {
    app_metadata: { role: newRole, tenant_id: tenantId },
  })

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'update',
    entity: 'tenant_users',
    entityId: member.user_id,
    before: { role: member.role },
    after: { role: newRole },
  })

  return { success: true, data: undefined }
}

// Legacy aliases kept for any existing callers
export async function resetAssistantPasswordAction(): Promise<ActionResult<{ tempPassword: string }>> {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const { data } = await admin
    .from('tenant_users')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('role', 'assistant')
    .limit(1)
    .single()
  if (!data) return { success: false, error: 'No assistant found', code: 'NOT_FOUND' }
  return resetMemberPasswordAction(data.id)
}

export async function deactivateAssistantAction(): Promise<ActionResult> {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const { data } = await admin
    .from('tenant_users')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('role', 'assistant')
    .limit(1)
    .single()
  if (!data) return { success: false, error: 'No assistant found', code: 'NOT_FOUND' }
  return deactivateMemberAction(data.id)
}

export async function reactivateAssistantAction(): Promise<ActionResult> {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const { data } = await admin
    .from('tenant_users')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('role', 'assistant')
    .limit(1)
    .single()
  if (!data) return { success: false, error: 'No assistant found', code: 'NOT_FOUND' }
  return reactivateMemberAction(data.id)
}
