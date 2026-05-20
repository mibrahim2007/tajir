'use server'

import { and, eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/db'
import { tenantUsers } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => chars[b % chars.length]).join('')
}

async function getActiveAssistant(tenantId: string) {
  return db
    .select()
    .from(tenantUsers)
    .where(
      and(
        eq(tenantUsers.tenantId, tenantId),
        eq(tenantUsers.role, 'assistant'),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null)
}

export async function resetAssistantPasswordAction(): Promise<
  ActionResult<{ tempPassword: string }>
> {
  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked')
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const assistant = await getActiveAssistant(tenantId)
  if (!assistant) return { success: false, error: 'No assistant found', code: 'NOT_FOUND' }

  const tempPassword = generateTempPassword()
  const admin = createAdminClient()

  const { error } = await admin.auth.admin.updateUserById(assistant.userId, {
    password: tempPassword,
  })

  if (error) return { success: false, error: error.message, code: 'UPDATE_ERROR' }

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'reset_assistant_password',
    entity: 'tenant_users',
    entityId: assistant.userId,
  })

  return { success: true, data: { tempPassword } }
}

export async function deactivateAssistantAction(): Promise<ActionResult> {
  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const assistant = await getActiveAssistant(tenantId)
  if (!assistant) return { success: false, error: 'No assistant found', code: 'NOT_FOUND' }

  const admin = createAdminClient()

  // Ban in Supabase Auth (prevents login immediately)
  const { error: banError } = await admin.auth.admin.updateUserById(assistant.userId, {
    ban_duration: '876600h', // 100 years — effectively permanent until reactivated
  })
  if (banError) return { success: false, error: banError.message, code: 'BAN_ERROR' }

  await db
    .update(tenantUsers)
    .set({ isActive: false })
    .where(eq(tenantUsers.id, assistant.id))

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'deactivate_assistant',
    entity: 'tenant_users',
    entityId: assistant.userId,
    before: { isActive: true },
    after: { isActive: false },
  })

  return { success: true, data: undefined }
}

export async function reactivateAssistantAction(): Promise<ActionResult> {
  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const assistant = await getActiveAssistant(tenantId)
  if (!assistant) return { success: false, error: 'No assistant found', code: 'NOT_FOUND' }

  const admin = createAdminClient()

  const { error: unbanError } = await admin.auth.admin.updateUserById(assistant.userId, {
    ban_duration: 'none',
  })
  if (unbanError) return { success: false, error: unbanError.message, code: 'UNBAN_ERROR' }

  await db
    .update(tenantUsers)
    .set({ isActive: true })
    .where(eq(tenantUsers.id, assistant.id))

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'reactivate_assistant',
    entity: 'tenant_users',
    entityId: assistant.userId,
    before: { isActive: false },
    after: { isActive: true },
  })

  return { success: true, data: undefined }
}
