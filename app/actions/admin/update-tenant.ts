'use server'

import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  subscriptionStatus: z.enum(['active', 'grace_period', 'locked', 'cancelled']),
  subscriptionExpiresAt: z.string().nullable().optional(),
})

export async function updateTenantAction(input: unknown): Promise<ActionResult<void>> {
  await requireAdmin()
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { id, name, subscriptionStatus, subscriptionExpiresAt } = parsed.data
  const admin = createAdminClient()
  const { error } = await admin
    .from('tenants')
    .update({ name, subscription_status: subscriptionStatus, subscription_expires_at: subscriptionExpiresAt ?? null })
    .eq('id', id)

  if (error) return { success: false, error: 'Failed to update tenant', code: 'INTERNAL_ERROR' }
  return { success: true, data: undefined }
}
