'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/db'
import { tenants, tenantUsers } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const registerSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function registerAction(formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = registerSchema.safeParse({
    businessName: formData.get('businessName'),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError?.message ?? 'Invalid input', code: 'INVALID_INPUT' }
  }

  const { businessName, email, password } = parsed.data

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

  try {
    const [tenant] = await db.insert(tenants).values({ name: businessName }).returning()

    const [tenantUser] = await db
      .insert(tenantUsers)
      .values({ tenantId: tenant.id, userId: authUserId, role: 'owner' })
      .returning()

    const admin = createAdminClient()
    const { error: metaError } = await admin.auth.admin.updateUserById(authUserId, {
      app_metadata: { role: 'owner', tenant_id: tenant.id },
    })

    if (metaError) {
      await db.delete(tenantUsers).where(eq(tenantUsers.id, tenantUser.id))
      await db.delete(tenants).where(eq(tenants.id, tenant.id))
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
