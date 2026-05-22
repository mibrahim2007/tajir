'use server'

import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  tenantId: z.string().uuid(),
  email:    z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role:     z.enum(['owner', 'assistant']),
})

export async function createTenantUserAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { tenantId, email, password, role } = parsed.data
  const admin = createAdminClient()

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { tenant_id: tenantId, role },
  })

  if (authError || !authData.user) {
    return { success: false, error: authError?.message ?? 'Failed to create user', code: 'INTERNAL_ERROR' }
  }

  const { error: tuError } = await admin.from('tenant_users').insert({
    tenant_id: tenantId,
    user_id:   authData.user.id,
    role,
  })

  if (tuError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return { success: false, error: 'Failed to register user in tenant', code: 'INTERNAL_ERROR' }
  }

  return { success: true, data: { id: authData.user.id } }
}
