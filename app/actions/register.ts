'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const registerSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-z0-9_]+$/, 'Username may only contain lowercase letters, numbers, and underscores'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function registerAction(formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = registerSchema.safeParse({
    businessName: formData.get('businessName'),
    username: (formData.get('username') as string | null)?.trim().toLowerCase(),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError?.message ?? 'Invalid input', code: 'INVALID_INPUT' }
  }

  const { businessName, username, email, password } = parsed.data

  const supabase = await createClient()
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })

  if (signUpError) {
    return { success: false, error: signUpError.message, code: 'SIGNUP_ERROR' }
  }

  if (!signUpData.user) {
    // Supabase returns null user (no error) when the email already exists but is unconfirmed.
    return {
      success: false,
      error: 'An account with this email already exists. Please check your inbox for a confirmation link or try signing in.',
      code: 'EMAIL_EXISTS',
    }
  }

  const authUserId = signUpData.user.id
  const admin = createAdminClient()

  let tenantId: string | null = null
  let tenantUserId: string | null = null

  try {
    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .insert({ name: businessName })
      .select('id')
      .single()

    if (tenantError || !tenant) {
      throw new Error(`Failed to create tenant: ${tenantError?.message ?? 'unknown'}`)
    }
    tenantId = tenant.id

    const { data: tenantUser, error: userError } = await admin
      .from('tenant_users')
      .insert({ tenant_id: tenant.id, user_id: authUserId, username, role: 'owner' })
      .select('id')
      .single()

    if (userError || !tenantUser) {
      await admin.from('tenants').delete().eq('id', tenant.id)
      // 23505 = unique_violation
      if (userError?.code === '23505' && userError.message?.includes('username')) {
        return { success: false, error: 'That username is already taken. Please choose a different one.', code: 'USERNAME_TAKEN' }
      }
      throw new Error(`Failed to create tenant user: ${userError?.message ?? 'unknown'}`)
    }
    tenantUserId = tenantUser.id

    const { error: metaError } = await admin.auth.admin.updateUserById(authUserId, {
      app_metadata: { role: 'owner', tenant_id: tenant.id },
    })

    if (metaError) {
      await admin.from('tenant_users').delete().eq('id', tenantUser.id)
      await admin.from('tenants').delete().eq('id', tenant.id)
      return {
        success: false,
        error: 'Failed to configure account. Please contact support.',
        code: 'METADATA_ERROR',
      }
    }

    await createAuditEntry({
      tenantId: tenant.id,
      userId: authUserId,
      action: 'create',
      entity: 'tenants',
      entityId: tenant.id,
      after: { name: businessName, role: 'owner' },
    })

    return { success: true, data: { redirectTo: '/dashboard' } }
  } catch (err) {
    // Best-effort cleanup of any partially-created records
    if (tenantUserId) await admin.from('tenant_users').delete().eq('id', tenantUserId)
    if (tenantId) await admin.from('tenants').delete().eq('id', tenantId)
    console.error('[register] error:', err)
    return { success: false, error: 'Registration failed. Please try again.', code: 'INTERNAL_ERROR' }
  }
}
