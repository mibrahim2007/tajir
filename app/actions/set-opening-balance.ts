'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const stockSchema = z.object({
  lotId:    z.string().uuid(),
  quantity: z.coerce.number().min(0, 'Quantity must be 0 or greater'),
  rate:     z.coerce.number().min(0, 'Rate must be 0 or greater').default(0),
})

const customerSchema = z.object({
  customerId:     z.string().uuid(),
  openingBalance: z.coerce.number().min(0),
  currencyCode:   z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:   z.coerce.number().positive().default(1),
})

const supplierSchema = z.object({
  supplierId:     z.string().uuid(),
  openingBalance: z.coerce.number().min(0),
  currencyCode:   z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:   z.coerce.number().positive().default(1),
})

export async function setStockOpeningBalance(input: unknown): Promise<ActionResult<void>> {
  const parsed = stockSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { lotId, quantity, rate } = parsed.data

  const admin = createAdminClient()

  const { data: lot } = await admin
    .from('inventory_lots')
    .select('current_quantity, opening_rate')
    .eq('id', lotId)
    .eq('tenant_id', tenantId)
    .single()

  if (!lot) return { success: false, error: 'Stock item not found', code: 'NOT_FOUND' }

  const { error } = await admin
    .from('inventory_lots')
    .update({ current_quantity: String(quantity), opening_rate: String(rate) })
    .eq('id', lotId)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update stock quantity', code: 'INTERNAL_ERROR' }

  await createAuditEntry({ tenantId, userId: user.id, action: 'set_opening_balance', entity: 'inventory_lots', entityId: lotId, before: { currentQuantity: lot.current_quantity, openingRate: lot.opening_rate }, after: { currentQuantity: quantity, openingRate: rate } })

  return { success: true, data: undefined }
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

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('tajir_customers')
    .select('opening_balance')
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .single()

  if (!existing) return { success: false, error: 'Customer not found', code: 'NOT_FOUND' }

  const { error } = await admin
    .from('tajir_customers')
    .update({ opening_balance: String(openingBalance), opening_balance_currency: currencyCode, opening_balance_pkr_equivalent: String(pkrEquivalent) })
    .eq('id', customerId)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update customer balance', code: 'INTERNAL_ERROR' }

  await createAuditEntry({ tenantId, userId: user.id, action: 'set_opening_balance', entity: 'tajir_customers', entityId: customerId, before: { openingBalance: existing.opening_balance }, after: { openingBalance, currencyCode, pkrEquivalent } })

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

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('suppliers')
    .select('opening_balance')
    .eq('id', supplierId)
    .eq('tenant_id', tenantId)
    .single()

  if (!existing) return { success: false, error: 'Supplier not found', code: 'NOT_FOUND' }

  const { error } = await admin
    .from('suppliers')
    .update({ opening_balance: String(openingBalance), opening_balance_currency: currencyCode, opening_balance_pkr_equivalent: String(pkrEquivalent) })
    .eq('id', supplierId)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update supplier balance', code: 'INTERNAL_ERROR' }

  await createAuditEntry({ tenantId, userId: user.id, action: 'set_opening_balance', entity: 'suppliers', entityId: supplierId, before: { openingBalance: existing.opening_balance }, after: { openingBalance, currencyCode, pkrEquivalent } })

  return { success: true, data: undefined }
}
