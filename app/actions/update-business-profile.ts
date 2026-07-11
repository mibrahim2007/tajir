'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  name: z.string().trim().min(1, 'Business name is required').max(120),
  ntn:  z.string().trim().max(60).optional(),
})

export async function updateBusinessProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const { name, ntn } = parsed.data
  const ntnValue = ntn && ntn.length > 0 ? ntn : null

  const admin = createAdminClient()
  const { error } = await admin
    .from('tenants')
    .update({ name, ntn: ntnValue })
    .eq('id', tenantId)

  if (error) return { success: false, error: error.message, code: 'UPDATE_ERROR' }

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'update',
    entity: 'tenants',
    entityId: tenantId,
    after: { name, ntn: ntnValue },
  })

  revalidatePath('/settings/business')
  return { success: true, data: undefined }
}
