'use server'

import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { salesOrders, inventoryLots } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { withSerializable } from '@/lib/db/with-serializable'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

export async function deleteSaleAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id } = parsed.data

  return withSerializable(async (tx) => {
    const sale = await tx.select().from(salesOrders)
      .where(and(eq(salesOrders.id, id), eq(salesOrders.tenantId, tenantId))).limit(1).then((r) => r[0] ?? null)
    if (!sale) return { success: false, error: 'Sale not found', code: 'NOT_FOUND' }

    await tx.delete(salesOrders).where(and(eq(salesOrders.id, id), eq(salesOrders.tenantId, tenantId)))

    // Restore stock quantity
    await tx.update(inventoryLots)
      .set({ currentQuantity: sql`current_quantity + ${parseFloat(sale.quantity)}` })
      .where(eq(inventoryLots.id, sale.stockItemId))

    await createAuditEntry({ tenantId, userId: user.id, action: 'delete', entity: 'sales_orders', entityId: id, before: { customerId: sale.customerId, stockItemId: sale.stockItemId, quantity: sale.quantity, rate: sale.rate, pkrEquivalent: sale.pkrEquivalent, date: sale.date } })

    return { success: true, data: undefined }
  })
}
