'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { planOpeningStock } from '@/lib/inventory/opening-stock'
import type { ActionResult } from '@/lib/types'

const stockLineSchema = z.object({
  locationId: z.string().uuid('Location is required'),
  quantity:   z.coerce.number().min(0, 'Quantity must be 0 or greater'),
  rate:       z.coerce.number().min(0, 'Rate must be 0 or greater').default(0),
})

const stockSchema = z.object({
  lotId: z.string().uuid(),
  // One line per warehouse holding the item on day one. An empty array (or one
  // that is all zeroes) clears the item's opening stock entirely.
  lines: z.array(stockLineSchema),
})

const customerSchema = z.object({
  customerId:     z.string().uuid(),
  openingBalance: z.coerce.number(),
  currencyCode:   z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:   z.coerce.number().positive().default(1),
})

const supplierSchema = z.object({
  supplierId:     z.string().uuid(),
  openingBalance: z.coerce.number(),
  currencyCode:   z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:   z.coerce.number().positive().default(1),
})

/**
 * Sets an item's opening stock across any number of locations at once.
 *
 * The per-location figures live in `stock_opening_balances`;
 * `inventory_lots.current_quantity` stays the item's running total, so it is
 * moved by the DIFFERENCE between the old and new opening totals rather than
 * overwritten — transactions posted since the opening was first entered keep
 * their effect. `opening_rate` is kept in sync as the quantity-weighted
 * average of the lines, since stock valuation falls back to it when an item
 * has never been purchased. The legacy `location_id` column is no longer read
 * by anything — it is still pointed at the largest line so a direct query of
 * the table does not see a stale warehouse.
 */
export async function setStockOpeningBalances(input: unknown): Promise<ActionResult<void>> {
  const parsed = stockSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { lotId, lines: submitted } = parsed.data

  const admin = createAdminClient()

  const locationIds = [...new Set(submitted.map((l) => l.locationId))]
  if (locationIds.length > 0) {
    const { data: locations } = await admin
      .from('locations')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('id', locationIds)

    if ((locations ?? []).length !== locationIds.length) return { success: false, error: 'Location not found', code: 'NOT_FOUND' }
  }

  const { data: lot } = await admin
    .from('inventory_lots')
    .select('current_quantity, opening_rate, location_id')
    .eq('id', lotId)
    .eq('tenant_id', tenantId)
    .single()

  if (!lot) return { success: false, error: 'Stock item not found', code: 'NOT_FOUND' }

  const { data: existingRows } = await admin
    .from('stock_opening_balances')
    .select('location_id, quantity, rate')
    .eq('tenant_id', tenantId)
    .eq('stock_item_id', lotId)

  const num = (v: unknown) => parseFloat(String(v ?? '0')) || 0

  const existing = (existingRows ?? []).map((r) => ({
    locationId: r.location_id,
    quantity:   num(r.quantity),
    rate:       num(r.rate),
  }))

  const planned = planOpeningStock({
    currentQuantity: num(lot.current_quantity),
    existing,
    lines: submitted,
  })

  if (!planned.ok) return { success: false, error: planned.error, code: 'VALIDATION_ERROR' }

  const { lines, removedLocationIds, currentQuantity, openingRate, primaryLocationId } = planned.plan
  const now = new Date().toISOString()

  if (lines.length > 0) {
    const { error: upsertError } = await admin
      .from('stock_opening_balances')
      .upsert(
        lines.map((l) => ({
          tenant_id:     tenantId,
          stock_item_id: lotId,
          location_id:   l.locationId,
          quantity:      l.quantity,
          rate:          l.rate,
          updated_at:    now,
        })),
        { onConflict: 'tenant_id,stock_item_id,location_id' },
      )

    if (upsertError) return { success: false, error: 'Failed to save opening stock', code: 'INTERNAL_ERROR' }
  }

  if (removedLocationIds.length > 0) {
    const { error: deleteError } = await admin
      .from('stock_opening_balances')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('stock_item_id', lotId)
      .in('location_id', removedLocationIds)

    if (deleteError) return { success: false, error: 'Failed to save opening stock', code: 'INTERNAL_ERROR' }
  }

  const { error } = await admin
    .from('inventory_lots')
    .update({ current_quantity: currentQuantity, opening_rate: openingRate, location_id: primaryLocationId })
    .eq('id', lotId)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update stock quantity', code: 'INTERNAL_ERROR' }

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'set_opening_balance',
    entity: 'inventory_lots',
    entityId: lotId,
    before: {
      currentQuantity: lot.current_quantity,
      openingRate: lot.opening_rate,
      locationId: lot.location_id,
      lines: existing,
    },
    after: {
      currentQuantity,
      openingRate,
      locationId: primaryLocationId,
      lines: lines.map((l) => ({ locationId: l.locationId, quantity: l.quantity, rate: l.rate })),
    },
  })

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
    .update({ opening_balance: openingBalance, opening_balance_currency: currencyCode, opening_balance_pkr_equivalent: pkrEquivalent })
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
    .update({ opening_balance: openingBalance, opening_balance_currency: currencyCode, opening_balance_pkr_equivalent: pkrEquivalent })
    .eq('id', supplierId)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update supplier balance', code: 'INTERNAL_ERROR' }

  await createAuditEntry({ tenantId, userId: user.id, action: 'set_opening_balance', entity: 'suppliers', entityId: supplierId, before: { openingBalance: existing.opening_balance }, after: { openingBalance, currencyCode, pkrEquivalent } })

  return { success: true, data: undefined }
}
