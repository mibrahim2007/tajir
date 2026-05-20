'use server'

import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { db } from '@/db'
import { customerPriceLists } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  customerId:   z.string().uuid('Invalid customer'),
  stockItemId:  z.string().uuid('Invalid stock item'),
  rate:         z.coerce.number().positive('Rate must be positive'),
})

export async function setPricingRuleAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { customerId, stockItemId, rate } = parsed.data

  await db.transaction(async (tx) => {
    // Supersede any existing active rule for this customer+item pair
    const existing = await tx
      .select({ id: customerPriceLists.id, rate: customerPriceLists.rate })
      .from(customerPriceLists)
      .where(and(
        eq(customerPriceLists.tenantId, tenantId),
        eq(customerPriceLists.customerId, customerId),
        eq(customerPriceLists.stockItemId, stockItemId),
        eq(customerPriceLists.isActive, true),
      ))
      .limit(1)
      .then((rows) => rows[0] ?? null)

    if (existing) {
      await tx.update(customerPriceLists)
        .set({ isActive: false, supersededAt: new Date() })
        .where(eq(customerPriceLists.id, existing.id))
    }

    const [newRule] = await tx.insert(customerPriceLists).values({
      tenantId, customerId, stockItemId,
      rate: String(rate),
      isActive: true,
    }).returning()

    await createAuditEntry({
      tenantId, userId: user.id,
      action: existing ? 'update' : 'create',
      entity: 'customer_price_lists',
      entityId: newRule.id,
      before: existing ? { rate: existing.rate } : undefined,
      after: { customerId, stockItemId, rate },
    })
  })

  return { success: true, data: undefined }
}
