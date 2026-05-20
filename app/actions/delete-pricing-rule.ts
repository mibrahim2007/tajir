'use server'

import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { db } from '@/db'
import { customerPriceLists } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

export async function deletePricingRuleAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id } = parsed.data

  const rule = await db.select().from(customerPriceLists).where(and(eq(customerPriceLists.id, id), eq(customerPriceLists.tenantId, tenantId))).limit(1).then((r) => r[0] ?? null)
  if (!rule) return { success: false, error: 'Pricing rule not found', code: 'NOT_FOUND' }

  await db.delete(customerPriceLists).where(and(eq(customerPriceLists.id, id), eq(customerPriceLists.tenantId, tenantId)))

  await createAuditEntry({ tenantId, userId: user.id, action: 'delete', entity: 'customer_price_lists', entityId: id, before: { customerId: rule.customerId, stockItemId: rule.stockItemId, rate: rule.rate, isActive: rule.isActive } })

  return { success: true, data: undefined }
}
