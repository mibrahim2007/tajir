'use server'

import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { db } from '@/db'
import { inventoryLots, tajirCustomers, suppliers } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { withSerializable } from '@/lib/db/with-serializable'
import type { ActionResult } from '@/lib/types'

const stockSchema = z.object({
  lotId: z.string().uuid(),
  quantity: z.coerce.number().min(0, 'Quantity must be 0 or greater'),
})

const customerSchema = z.object({
  customerId: z.string().uuid(),
  openingBalance: z.coerce.number().min(0),
  currencyCode: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.coerce.number().positive().default(1),
})

const supplierSchema = z.object({
  supplierId: z.string().uuid(),
  openingBalance: z.coerce.number().min(0),
  currencyCode: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.coerce.number().positive().default(1),
})

export async function setStockOpeningBalance(input: unknown): Promise<ActionResult<void>> {
  const parsed = stockSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { lotId, quantity } = parsed.data

  return withSerializable(async (tx) => {
    const lot = await tx.select({ currentQuantity: inventoryLots.currentQuantity }).from(inventoryLots)
      .where(and(eq(inventoryLots.id, lotId), eq(inventoryLots.tenantId, tenantId))).limit(1).then((r) => r[0] ?? null)
    if (!lot) return { success: false, error: 'Stock item not found', code: 'NOT_FOUND' }

    await tx.update(inventoryLots)
      .set({ currentQuantity: String(quantity) })
      .where(and(eq(inventoryLots.id, lotId), eq(inventoryLots.tenantId, tenantId)))

    await createAuditEntry({ tenantId, userId: user.id, action: 'set_opening_balance', entity: 'inventory_lots', entityId: lotId, before: { currentQuantity: lot.currentQuantity }, after: { currentQuantity: quantity } })

    return { success: true, data: undefined }
  })
}

export async function setCustomerOpeningBalance(input: unknown): Promise<ActionResult<void>> {
  const parsed = customerSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { customerId, openingBalance, currencyCode, exchangeRate } = parsed.data
  const pkrEquivalent = currencyCode === 'USD' ? openingBalance * exchangeRate : openingBalance

  const existing = await db.select({ openingBalance: tajirCustomers.openingBalance })
    .from(tajirCustomers).where(and(eq(tajirCustomers.id, customerId), eq(tajirCustomers.tenantId, tenantId))).limit(1).then((r) => r[0] ?? null)
  if (!existing) return { success: false, error: 'Customer not found', code: 'NOT_FOUND' }

  await db.update(tajirCustomers)
    .set({ openingBalance: String(openingBalance), openingBalanceCurrency: currencyCode, openingBalancePkrEquivalent: String(pkrEquivalent) })
    .where(and(eq(tajirCustomers.id, customerId), eq(tajirCustomers.tenantId, tenantId)))

  await createAuditEntry({ tenantId, userId: user.id, action: 'set_opening_balance', entity: 'tajir_customers', entityId: customerId, before: { openingBalance: existing.openingBalance }, after: { openingBalance, currencyCode, pkrEquivalent } })

  return { success: true, data: undefined }
}

export async function setSupplierOpeningBalance(input: unknown): Promise<ActionResult<void>> {
  const parsed = supplierSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { supplierId, openingBalance, currencyCode, exchangeRate } = parsed.data
  const pkrEquivalent = currencyCode === 'USD' ? openingBalance * exchangeRate : openingBalance

  const existing = await db.select({ openingBalance: suppliers.openingBalance })
    .from(suppliers).where(and(eq(suppliers.id, supplierId), eq(suppliers.tenantId, tenantId))).limit(1).then((r) => r[0] ?? null)
  if (!existing) return { success: false, error: 'Supplier not found', code: 'NOT_FOUND' }

  await db.update(suppliers)
    .set({ openingBalance: String(openingBalance), openingBalanceCurrency: currencyCode, openingBalancePkrEquivalent: String(pkrEquivalent) })
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.tenantId, tenantId)))

  await createAuditEntry({ tenantId, userId: user.id, action: 'set_opening_balance', entity: 'suppliers', entityId: supplierId, before: { openingBalance: existing.openingBalance }, after: { openingBalance, currencyCode, pkrEquivalent } })

  return { success: true, data: undefined }
}
