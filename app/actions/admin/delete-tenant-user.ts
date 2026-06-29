'use server'

import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ userId: z.string().uuid() })

export async function deleteTenantUserAction(input: unknown): Promise<ActionResult<void>> {
  await requireAdmin()
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const admin = createAdminClient()
  // tenant_users row is cleaned up by cascade or will be orphaned; delete auth user first
  const { error } = await admin.auth.admin.deleteUser(parsed.data.userId)
  if (error) return { success: false, error: 'Failed to delete user', code: 'INTERNAL_ERROR' }

  // Clean up tenant_users record (auth.users has no FK to tenant_users)
  await admin.from('tenant_users').delete().eq('user_id', parsed.data.userId)

  return { success: true, data: undefined }
}
