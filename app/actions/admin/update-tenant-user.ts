'use server'

import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  userId:      z.string().uuid(),
  tenantId:    z.string().uuid(),
  role:        z.enum(['owner', 'assistant']),
  isActive:    z.boolean(),
  newPassword: z.string().min(8).optional().or(z.literal('')),
})

export async function updateTenantUserAction(input: unknown): Promise<ActionResult<void>> {
  await requireAdmin()
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { userId, tenantId, role, isActive, newPassword } = parsed.data
  const admin = createAdminClient()

  // If deactivating, clear app_metadata so requireAuth() redirects to login
  const appMeta = isActive
    ? { tenant_id: tenantId, role }
    : { tenant_id: null, role: null }

  const authUpdate: Record<string, unknown> = { app_metadata: appMeta }
  if (newPassword) authUpdate.password = newPassword

  const { error: authError } = await admin.auth.admin.updateUserById(userId, authUpdate)
  if (authError) return { success: false, error: authError.message, code: 'INTERNAL_ERROR' }

  const { error } = await admin
    .from('tenant_users')
    .update({ role, is_active: isActive })
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update user', code: 'INTERNAL_ERROR' }
  return { success: true, data: undefined }
}
