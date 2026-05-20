'use server'

import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { purchaseOrders, inventoryLots } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { withSerializable } from '@/lib/db/with-serializable'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

export async function deletePurchaseAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id } = parsed.data

  return withSerializable(async (tx) => {
    const purchase = await tx.select().from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId))).limit(1).then((r) => r[0] ?? null)
    if (!purchase) return { success: false, error: 'Purchase not found', code: 'NOT_FOUND' }

    await tx.delete(purchaseOrders).where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)))

    await tx.update(inventoryLots)
      .set({ currentQuantity: sql`current_quantity - ${parseFloat(purchase.quantity)}` })
      .where(eq(inventoryLots.id, purchase.stockItemId))

    await createAuditEntry({ tenantId, userId: user.id, action: 'delete', entity: 'purchase_orders', entityId: id, before: { supplierId: purchase.supplierId, stockItemId: purchase.stockItemId, quantity: purchase.quantity, rate: purchase.rate, pkrEquivalent: purchase.pkrEquivalent, date: purchase.date } })

    return { success: true, data: undefined }
  })
}
