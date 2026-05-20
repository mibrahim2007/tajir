'use server'

import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { db } from '@/db'
import { purchaseOrders, inventoryLots } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { withSerializable } from '@/lib/db/with-serializable'
import type { ActionResult } from '@/lib/types'
import type { PurchaseOrder } from '@/db/schema'

const schema = z.object({
  supplierId:   z.string().uuid('Invalid supplier'),
  stockItemId:  z.string().uuid('Invalid stock item'),
  quantity:     z.coerce.number().positive('Quantity must be positive'),
  rate:         z.coerce.number().positive('Rate must be positive'),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.coerce.number().positive().default(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  advancePaid:  z.coerce.number().min(0).default(0),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD transactions', path: ['exchangeRate'] },
)

export type CreatePurchaseInput = z.infer<typeof schema>

export async function createPurchaseAction(
  input: unknown,
): Promise<ActionResult<PurchaseOrder>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, tenantId } = await requireAuth()

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { supplierId, stockItemId, quantity, rate, currencyCode, exchangeRate, date, advancePaid } =
    parsed.data

  const pkrEquivalent = quantity * rate * (currencyCode === 'USD' ? exchangeRate : 1)

  return withSerializable(async (tx) => {
    const [order] = await tx
      .insert(purchaseOrders)
      .values({
        tenantId,
        supplierId,
        stockItemId,
        quantity: String(quantity),
        rate: String(rate),
        currencyCode,
        exchangeRate: String(exchangeRate),
        pkrEquivalent: String(pkrEquivalent),
        advancePaid: String(advancePaid),
        date,
        confirmedAt: new Date(),
      })
      .returning()

    // Increment inventory — negative check enforced by DB constraint
    await tx
      .update(inventoryLots)
      .set({ currentQuantity: sql`current_quantity + ${quantity}` })
      .where(eq(inventoryLots.id, stockItemId))

    await createAuditEntry({
      tenantId,
      userId: user.id,
      action: 'create',
      entity: 'purchase_orders',
      entityId: order.id,
      after: { supplierId, stockItemId, quantity, rate, currencyCode, pkrEquivalent, date },
    })

    return { success: true, data: order }
  })
}
