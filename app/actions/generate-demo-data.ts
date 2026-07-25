'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { runGeneration } from '@/lib/playground/generate'
import { LIMITS } from '@/lib/playground/types'
import type { ActionResult } from '@/lib/types'
import type { GenerateResult } from '@/lib/playground/types'

const schema = z.object({
  itemTypes:    z.array(z.string().trim().min(1).max(60)).min(1).max(LIMITS.itemTypes),
  itemsPerType: z.number().int().min(1).max(LIMITS.itemsPerType),
  locations:    z.number().int().min(0).max(LIMITS.locations),
  suppliers:    z.number().int().min(0).max(LIMITS.suppliers),
  customers:    z.number().int().min(0).max(LIMITS.customers),
  employees:    z.number().int().min(0).max(LIMITS.employees),
  users:        z.number().int().min(0).max(LIMITS.users),
  days:         z.number().int().min(0).max(LIMITS.days),
  autoRemove:   z.boolean(),
})

export async function generateDemoDataAction(input: unknown): Promise<ActionResult<GenerateResult>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') {
    return { success: false, error: 'Only the owner can generate demo data', code: 'UNAUTHORIZED' }
  }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  try {
    const result = await runGeneration(tenantId, user.id, parsed.data)
    await createAuditEntry({
      tenantId, userId: user.id, action: 'create',
      entity: 'demo_batches', entityId: result.batchId,
      after: { config: parsed.data, summary: result.summary },
    })
    return { success: true, data: result }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to generate demo data', code: 'INTERNAL_ERROR' }
  }
}
