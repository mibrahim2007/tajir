'use server'

import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { purchaseOrders, inventoryLots } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { withSerializable } from '@/lib/db/with-serializable'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  id:           z.string().uuid(),
  supplierId:   z.string().uuid(),
  stockItemId:  z.string().uuid(),
  quantity:     z.coerce.number().positive(),
  rate:         z.coerce.number().positive(),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.coerce.number().positive().default(1),
  advancePaid:  z.coerce.number().min(0).default(0),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function editPurchaseAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, supplierId, stockItemId, quantity, rate, currencyCode, exchangeRate, advancePaid, date } = parsed.data
  const pkrEquivalent = quantity * rate * (currencyCode === 'USD' ? exchangeRate : 1)

  return withSerializable(async (tx) => {
    const existing = await tx.select().from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId))).limit(1).then((r) => r[0] ?? null)
    if (!existing) return { success: false, error: 'Purchase not found', code: 'NOT_FOUND' }

    const oldQty = parseFloat(existing.quantity)
    const qtyDelta = quantity - oldQty

    await tx.update(purchaseOrders).set({
      supplierId, stockItemId,
      quantity: String(quantity), rate: String(rate), currencyCode,
      exchangeRate: String(exchangeRate), pkrEquivalent: String(pkrEquivalent),
      advancePaid: String(advancePaid), date,
    }).where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)))

    if (qtyDelta !== 0) {
      await tx.update(inventoryLots)
        .set({ currentQuantity: sql`current_quantity + ${qtyDelta}` })
        .where(eq(inventoryLots.id, stockItemId))
    }

    await createAuditEntry({ tenantId, userId: user.id, action: 'update', entity: 'purchase_orders', entityId: id, before: { quantity: existing.quantity, rate: existing.rate, pkrEquivalent: existing.pkrEquivalent, date: existing.date }, after: { quantity, rate, pkrEquivalent, date } })

    return { success: true, data: undefined }
  })
}
