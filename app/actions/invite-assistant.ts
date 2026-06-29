'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['owner', 'assistant']).default('assistant'),
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
  const parsed = schema.safeParse({
    email: formData.get('email'),
    role: formData.get('role') ?? 'assistant',
  })
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
  const { email, role: memberRole } = parsed.data
  const tempPassword = generateTempPassword()

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    app_metadata: { role: memberRole, tenant_id: tenantId },
    email_confirm: true,
  })

  if (createError || !newUser.user) {
    return {
      success: false,
      error: createError?.message ?? 'Failed to create account',
      code: 'CREATE_USER_ERROR',
    }
  }

  const newUserId = newUser.user.id

  try {
    const { error: insertError } = await admin.from('tenant_users').insert({
      tenant_id: tenantId,
      user_id: newUserId,
      role: memberRole,
    })

    if (insertError) throw insertError

    await createAuditEntry({
      tenantId,
      userId: user.id,
      action: 'create',
      entity: 'tenant_users',
      entityId: newUserId,
      after: { role: memberRole, email },
    })

    return { success: true, data: { email, tempPassword } }
  } catch {
    await admin.auth.admin.deleteUser(newUserId)
    return { success: false, error: 'Failed to save team member. Please try again.', code: 'INTERNAL_ERROR' }
  }
}
