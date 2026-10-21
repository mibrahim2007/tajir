'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { planOpeningStock, openingLineKey, type OpeningStockLine } from '@/lib/inventory/opening-stock'
import { loadProfilesFor, profileOf, profileAt } from '@/lib/inventory/item-profiles'
import { resolveLineTracking } from '@/lib/inventory/line-tracking'
import { cartonStockQty, usesCartons, ITEM_FORMULAS } from '@/lib/item-formula'
import type { ActionResult } from '@/lib/types'

const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
  z.coerce.number().min(0).optional(),
)

const stockLineSchema = z.object({
  locationId: z.string().uuid('Location is required'),
  quantity:   z.coerce.number().min(0, 'Quantity must be 0 or greater'),
  // Cost per STOCK unit (per kg for weighed yarn, per piece / bag otherwise).
  rate:       z.coerce.number().min(0, 'Rate must be 0 or greater').default(0),
  // How this line is measured (0074); defaults to the item's last-used basis.
  rateBasis:  z.enum(ITEM_FORMULAS).optional(),
  // Grade / lot, required when the line's basis is not Qty × Rate.
  gradeId:    z.string().uuid().nullable().optional(),
  lotNo:      z.string().trim().max(60).nullable().optional(),
  // Carton bases (per lb / kg / pack): the quantity is derived from these.
  nosCarton:       optionalNumber,
  weightPerCarton: optionalNumber,
})

const stockSchema = z.object({
  lotId: z.string().uuid(),
  // One line per warehouse × grade × lot holding the item on day one. An empty
  // array (or one that is all zeroes) clears the item's opening stock entirely.
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
 * Sets an item's opening stock across any number of locations at once, split
 * by grade and lot where the item's type tracks them.
 *
 * The per-location figures live in `stock_opening_balances` (one row per
 * location × grade × lot);
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
    .select('id, location_id, quantity, rate, grade_id, lot_no')
    .eq('tenant_id', tenantId)
    .eq('stock_item_id', lotId)

  const num = (v: unknown) => parseFloat(String(v ?? '0')) || 0

  const existing = (existingRows ?? []).map((r) => ({
    id:         r.id,
    locationId: r.location_id,
    quantity:   num(r.quantity),
    rate:       num(r.rate),
    gradeId:    r.grade_id,
    lotNo:      r.lot_no,
  }))

  // Each line's rate basis derives carton quantities and requires a grade /
  // lot when it isn't Qty × Rate. A tracked lot left blank gets "OB/<line>".
  const itemProfile = profileOf(await loadProfilesFor(admin, tenantId, [lotId]), lotId)
  const prepared: OpeningStockLine[] = []
  for (let i = 0; i < submitted.length; i++) {
    const l = submitted[i]
    const profile = profileAt(itemProfile, l.rateBasis ?? itemProfile.formula)
    const carton = usesCartons(profile.formula)
    const quantity = carton ? (cartonStockQty(profile.formula, l) ?? 0) : l.quantity
    // Blank rows are dropped by planOpeningStock; don't demand a grade for them.
    if (!(quantity > 0) && !(l.rate > 0)) { prepared.push({ ...l, quantity, gradeId: null, lotNo: null, rateBasis: profile.formula }); continue }
    const tracked = resolveLineTracking(profile, l, {
      lineLabel: `Line ${i + 1}`,
      generateLot: { serialNumber: 'OB', lineIndex: i },
    })
    if (!tracked.ok) return { success: false, error: tracked.error, code: 'VALIDATION_ERROR' }
    prepared.push({
      locationId:      l.locationId,
      quantity,
      rate:            l.rate,
      gradeId:         tracked.gradeId,
      lotNo:           tracked.lotNo,
      nosCarton:       carton ? (l.nosCarton ?? null) : null,
      weightPerCarton: carton ? (l.weightPerCarton ?? null) : null,
      rateBasis:       profile.formula,
    })
  }

  const gradeIds = [...new Set(prepared.map((l) => l.gradeId).filter(Boolean) as string[])]
  if (gradeIds.length > 0) {
    const { data: grades } = await admin.from('grades').select('id').eq('tenant_id', tenantId).in('id', gradeIds)
    if ((grades ?? []).length !== gradeIds.length) return { success: false, error: 'Grade not found', code: 'NOT_FOUND' }
  }

  const planned = planOpeningStock({
    currentQuantity: num(lot.current_quantity),
    existing,
    lines: prepared,
  })

  if (!planned.ok) return { success: false, error: planned.error, code: 'VALIDATION_ERROR' }

  const { lines, currentQuantity, openingRate, primaryLocationId } = planned.plan
  const now = new Date().toISOString()

  // Rows are identified by location × grade × lot. The unique index on that is
  // an expression index, so upsert can't target it: update the rows whose key
  // survives, insert the new keys, then delete the keys that are gone.
  const existingByKey = new Map(existing.map((r) => [openingLineKey(r), r]))
  const keptIds = new Set<string>()
  const toInsert: OpeningStockLine[] = []
  for (const l of lines) {
    const match = existingByKey.get(openingLineKey(l))
    if (match) keptIds.add(match.id)
    const row = {
      quantity:          l.quantity,
      rate:              l.rate,
      nos_carton:        l.nosCarton ?? null,
      weight_per_carton: l.weightPerCarton ?? null,
      rate_basis:        l.rateBasis ?? 'standard',
      updated_at:        now,
    }
    if (match) {
      const { error: updateError } = await admin
        .from('stock_opening_balances').update(row).eq('id', match.id).eq('tenant_id', tenantId)
      if (updateError) return { success: false, error: 'Failed to save opening stock', code: 'INTERNAL_ERROR' }
    } else {
      toInsert.push(l)
    }
  }

  // New keys can't collide with existing rows, so insert them first; the old
  // keys are only deleted once the replacements exist.
  let insertedIds: string[] = []
  if (toInsert.length > 0) {
    const { data: inserted, error: insertError } = await admin
      .from('stock_opening_balances')
      .insert(toInsert.map((l) => ({
        tenant_id:         tenantId,
        stock_item_id:     lotId,
        location_id:       l.locationId,
        grade_id:          l.gradeId ?? null,
        lot_no:            l.lotNo ?? null,
        quantity:          l.quantity,
        rate:              l.rate,
        nos_carton:        l.nosCarton ?? null,
        weight_per_carton: l.weightPerCarton ?? null,
        rate_basis:        l.rateBasis ?? 'standard',
        updated_at:        now,
      })))
      .select('id')
    if (insertError) return { success: false, error: 'Failed to save opening stock', code: 'INTERNAL_ERROR' }
    insertedIds = (inserted ?? []).map((r) => r.id)
  }

  const removedIds = existing.map((r) => r.id).filter((id) => !keptIds.has(id))
  if (removedIds.length > 0) {
    const { error: deleteError } = await admin
      .from('stock_opening_balances').delete().eq('tenant_id', tenantId).in('id', removedIds)
    if (deleteError) {
      if (insertedIds.length > 0) await admin.from('stock_opening_balances').delete().in('id', insertedIds)
      return { success: false, error: 'Failed to save opening stock', code: 'INTERNAL_ERROR' }
    }
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
      lines: existing.map((r) => ({ locationId: r.locationId, gradeId: r.gradeId, lotNo: r.lotNo, quantity: r.quantity, rate: r.rate })),
    },
    after: {
      currentQuantity,
      openingRate,
      locationId: primaryLocationId,
      lines: lines.map((l) => ({ locationId: l.locationId, gradeId: l.gradeId ?? null, lotNo: l.lotNo ?? null, quantity: l.quantity, rate: l.rate })),
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
