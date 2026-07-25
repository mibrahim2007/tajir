'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { runRemoval } from '@/lib/playground/generate'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ batchId: z.string().uuid() })

export async function removeDemoDataAction(input: unknown): Promise<ActionResult<{ removed: number }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') {
    return { success: false, error: 'Only the owner can remove demo data', code: 'UNAUTHORIZED' }
  }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  try {
    const result = await runRemoval(tenantId, parsed.data.batchId)
    await createAuditEntry({
      tenantId, userId: user.id, action: 'delete',
      entity: 'demo_batches', entityId: parsed.data.batchId,
      before: { removed: result.removed },
    })
    return { success: true, data: result }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to remove demo data', code: 'INTERNAL_ERROR' }
  }
}
