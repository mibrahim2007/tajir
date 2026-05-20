'use server'

import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { db } from '@/db'
import { salesOrders, inventoryLots } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { withSerializable } from '@/lib/db/with-serializable'
import type { ActionResult } from '@/lib/types'
import type { SalesOrder } from '@/db/schema'

const schema = z.object({
  customerId:      z.string().uuid('Invalid customer'),
  stockItemId:     z.string().uuid('Invalid stock item'),
  quantity:        z.coerce.number().positive('Quantity must be positive'),
  rate:            z.coerce.number().positive('Rate must be positive'),
  currencyCode:    z.enum(['PKR', 'USD']),
  exchangeRate:    z.coerce.number().positive().default(1),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentDueDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  allowOversell:   z.boolean().optional(),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD transactions', path: ['exchangeRate'] },
)

export type CreateSaleInput = z.infer<typeof schema>

export async function createSaleOrderAction(input: unknown): Promise<
  ActionResult<SalesOrder> | { success: false; code: 'OVERSELL'; available: number; requested: number }
> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, role, tenantId } = await requireAuth()

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { customerId, stockItemId, quantity, rate, currencyCode, exchangeRate, date, paymentDueDate, allowOversell } = parsed.data
  const pkrEquivalent = quantity * rate * (currencyCode === 'USD' ? exchangeRate : 1)

  return withSerializable(async (tx) => {
    // Check available quantity
    const lot = await tx
      .select({ currentQuantity: inventoryLots.currentQuantity })
      .from(inventoryLots)
      .where(and(eq(inventoryLots.id, stockItemId), eq(inventoryLots.tenantId, tenantId)))
      .limit(1)
      .then((rows) => rows[0] ?? null)

    const available = lot ? parseFloat(lot.currentQuantity) : 0

    if (available < quantity && !allowOversell) {
      return { success: false as const, error: 'Insufficient stock', code: 'OVERSELL' as const, available, requested: quantity }
    }

    // Assistants cannot oversell even if allowOversell is sent
    if (available < quantity && allowOversell && role === 'assistant') {
      return { success: false, error: 'Only the Owner can override stock limits', code: 'UNAUTHORIZED' }
    }

    const [order] = await tx.insert(salesOrders).values({
      tenantId, customerId, stockItemId,
      quantity: String(quantity),
      rate: String(rate),
      currencyCode,
      exchangeRate: String(exchangeRate),
      pkrEquivalent: String(pkrEquivalent),
      date,
      paymentDueDate: paymentDueDate ?? null,
      confirmedAt: new Date(),
    }).returning()

    // Decrement inventory (may go negative for owner oversell)
    await tx.update(inventoryLots)
      .set({ currentQuantity: sql`current_quantity - ${quantity}` })
      .where(eq(inventoryLots.id, stockItemId))

    await createAuditEntry({ tenantId, userId: user.id, action: 'create', entity: 'sales_orders', entityId: order.id, after: { customerId, stockItemId, quantity, rate, currencyCode, pkrEquivalent, date } })

    return { success: true, data: order }
  })
}
