'use server'

import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  subscriptionStatus: z.enum(['active', 'grace_period', 'locked', 'cancelled']).default('active'),
})

export async function createTenantAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tenants')
    .insert({ name: parsed.data.name, subscription_status: parsed.data.subscriptionStatus })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: 'Failed to create tenant', code: 'INTERNAL_ERROR' }
  return { success: true, data }
}
