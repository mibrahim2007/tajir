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

  if (signUpError || !signUpData.user) {
    return {
      success: false,
      error: signUpError?.message ?? 'Registration failed',
      code: 'SIGNUP_ERROR',
    }
  }

  const authUserId = signUpData.user.id
  const admin = createAdminClient()

  try {
    // Insert tenant
    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .insert({ name: businessName })
      .select('id')
      .single()

    if (tenantError || !tenant) throw new Error('Failed to create tenant')

    // Insert tenant user
    const { data: tenantUser, error: userError } = await admin
      .from('tenant_users')
      .insert({ tenant_id: tenant.id, user_id: authUserId, username, role: 'owner' })
      .select('id')
      .single()

    if (userError || !tenantUser) {
      await admin.from('tenants').delete().eq('id', tenant.id)
      throw new Error('Failed to create tenant user')
    }

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
  } catch {
    return { success: false, error: 'Registration failed. Please try again.', code: 'INTERNAL_ERROR' }
  }
}
