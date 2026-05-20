'use server'

import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { salesOrders, inventoryLots } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { withSerializable } from '@/lib/db/with-serializable'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  id:             z.string().uuid(),
  customerId:     z.string().uuid(),
  stockItemId:    z.string().uuid(),
  quantity:       z.coerce.number().positive(),
  rate:           z.coerce.number().positive(),
  currencyCode:   z.enum(['PKR', 'USD']),
  exchangeRate:   z.coerce.number().positive().default(1),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function editSaleAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, customerId, stockItemId, quantity, rate, currencyCode, exchangeRate, date, paymentDueDate } = parsed.data
  const pkrEquivalent = quantity * rate * (currencyCode === 'USD' ? exchangeRate : 1)

  return withSerializable(async (tx) => {
    const existing = await tx.select().from(salesOrders)
      .where(and(eq(salesOrders.id, id), eq(salesOrders.tenantId, tenantId))).limit(1).then((r) => r[0] ?? null)
    if (!existing) return { success: false, error: 'Sale not found', code: 'NOT_FOUND' }

    const oldQty = parseFloat(existing.quantity)
    // positive delta means we're selling more → decrease inventory
    const qtyDelta = quantity - oldQty

    await tx.update(salesOrders).set({
      customerId, stockItemId,
      quantity: String(quantity), rate: String(rate), currencyCode,
      exchangeRate: String(exchangeRate), pkrEquivalent: String(pkrEquivalent),
      date, paymentDueDate: paymentDueDate ?? null,
    }).where(and(eq(salesOrders.id, id), eq(salesOrders.tenantId, tenantId)))

    if (qtyDelta !== 0) {
      await tx.update(inventoryLots)
        .set({ currentQuantity: sql`current_quantity - ${qtyDelta}` })
        .where(eq(inventoryLots.id, stockItemId))
    }

    await createAuditEntry({ tenantId, userId: user.id, action: 'update', entity: 'sales_orders', entityId: id, before: { quantity: existing.quantity, rate: existing.rate, pkrEquivalent: existing.pkrEquivalent, date: existing.date }, after: { quantity, rate, pkrEquivalent, date } })

    return { success: true, data: undefined }
  })
}
