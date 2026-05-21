'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  email: z.string().email('Invalid email address'),
})

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => chars[byte % chars.length]).join('')
}

export async function inviteAssistantAction(
  formData: FormData,
): Promise<ActionResult<{ email: string; tempPassword: string }>> {
  const parsed = schema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 'INVALID_INPUT' }
  }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') {
    return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }
  }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const admin = createAdminClient()

  // Block if an active assistant already exists
  const { data: existing } = await admin
    .from('tenant_users')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('role', 'assistant')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (existing) {
    return {
      success: false,
      error: 'An assistant already exists for this account',
      code: 'ASSISTANT_EXISTS',
    }
  }

  const tempPassword = generateTempPassword()
  const { email } = parsed.data

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    app_metadata: { role: 'assistant', tenant_id: tenantId },
    email_confirm: true,
  })

  if (createError || !newUser.user) {
    return {
      success: false,
      error: createError?.message ?? 'Failed to create assistant account',
      code: 'CREATE_USER_ERROR',
    }
  }

  const assistantUserId = newUser.user.id

  try {
    const { error: insertError } = await admin.from('tenant_users').insert({
      tenant_id: tenantId,
      user_id: assistantUserId,
      role: 'assistant',
    })

    if (insertError) throw insertError

    await createAuditEntry({
      tenantId,
      userId: user.id,
      action: 'create',
      entity: 'tenant_users',
      entityId: assistantUserId,
      after: { role: 'assistant', email },
    })

    return { success: true, data: { email, tempPassword } }
  } catch {
    await admin.auth.admin.deleteUser(assistantUserId)
    return { success: false, error: 'Failed to save assistant. Please try again.', code: 'INTERNAL_ERROR' }
  }
}
