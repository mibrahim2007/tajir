'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  name:    z.string().min(1, 'Location name is required').max(100),
  address: z.string().max(500).optional(),
})

export async function createLocationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, tenantId } = await requireAuth()
  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { name, address } = parsed.data
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('locations')
    .insert({ tenant_id: tenantId, name, address: address ?? null })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: 'Failed to create location', code: 'INTERNAL_ERROR' }

  await createAuditEntry({ tenantId, userId: user.id, action: 'create', entity: 'locations', entityId: data.id, after: { name, address } })
  return { success: true, data }
}
