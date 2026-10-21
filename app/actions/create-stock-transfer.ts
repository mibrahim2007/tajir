'use server'

import { z } from 'zod'
import { documentDateSchema } from '@/lib/validation/document-date'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { loadProfilesFor, profileOf } from '@/lib/inventory/item-profiles'
import { loadStockPositions } from '@/lib/inventory/stock-position'
import { resolveLineTracking, findPositionShortfalls } from '@/lib/inventory/line-tracking'
import { cartonStockQty, usesCartons } from '@/lib/item-formula'
import type { ActionResult } from '@/lib/types'

const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
  z.coerce.number().min(0).optional(),
)

const schema = z.object({
  fromLocationId: z.string().uuid('Invalid from-location'),
  toLocationId:   z.string().uuid('Invalid to-location'),
  stockItemId:    z.string().uuid('Invalid stock item'),
  // Typed for count items; derived from the cartons for carton formulas.
  quantity:       optionalNumber,
  // Grade / lot being moved, required when the item's type tracks them (0072).
  gradeId:        z.string().uuid().nullable().optional(),
  lotNo:          z.string().trim().max(60).nullable().optional(),
  nosCarton:       optionalNumber,
  weightPerCarton: optionalNumber,
  date:           documentDateSchema,
  notes:          z.string().max(500).optional(),
}).refine(
  (d) => d.fromLocationId !== d.toLocationId,
  { message: 'From and To locations must differ', path: ['toLocationId'] },
)

export async function createStockTransferAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, tenantId } = await requireAuth()
  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { fromLocationId, toLocationId, stockItemId, date, notes } = parsed.data
  const admin = createAdminClient()

  // Transfers have no rate basis of their own: the item's default (last-used)
  // basis derives a carton line's quantity (cartons × kg; per pack: packs).
  // Grade / lot are required when that basis tracks them, or when the stock at
  // the from-location is held by grade / lot (bought per lb, moved lot by lot).
  const itemProfile = profileOf(await loadProfilesFor(admin, tenantId, [stockItemId]), stockItemId)
  const positions = await loadStockPositions(admin, tenantId, { stockItemIds: [stockItemId], locationId: fromLocationId })
  const held = positions.filter((p) => p.quantity > 0)
  const profile = {
    ...itemProfile,
    trackGrade: itemProfile.trackGrade || held.some((p) => p.gradeId),
    trackLot:   itemProfile.trackLot || held.some((p) => p.lotNo),
  }
  const carton = usesCartons(profile.formula)
  const quantity = cartonStockQty(profile.formula, parsed.data) ?? parsed.data.quantity ?? 0
  if (!(quantity > 0)) {
    return { success: false, error: carton ? 'Enter Nos Carton (and Weight)' : 'Quantity must be positive', code: 'VALIDATION_ERROR' }
  }

  const tracked = resolveLineTracking(profile, parsed.data, { lineLabel: 'Transfer' })
  if (!tracked.ok) return { success: false, error: tracked.error, code: 'VALIDATION_ERROR' }
  const { gradeId, lotNo } = tracked

  // A tracked grade / lot can only be moved out of a godown that holds it.
  if (profile.trackGrade || profile.trackLot) {
    const short = findPositionShortfalls(positions, [{
      stockItemId, locationId: fromLocationId, gradeId, lotNo, quantity,
      trackGrade: profile.trackGrade, trackLot: profile.trackLot,
    }])
    if (short.length > 0) {
      return {
        success: false,
        error: `Only ${short[0].available.toLocaleString()} of that grade / lot is at the from-location.`,
        code: 'INSUFFICIENT_STOCK',
      }
    }
  }

  const { data, error } = await admin
    .from('stock_transfers')
    .insert({
      tenant_id:        tenantId,
      from_location_id: fromLocationId,
      to_location_id:   toLocationId,
      stock_item_id:    stockItemId,
      quantity:         quantity,
      grade_id:         gradeId,
      lot_no:           lotNo,
      nos_carton:       carton ? (parsed.data.nosCarton ?? null) : null,
      date,
      notes:            notes ?? null,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: 'Failed to create transfer', code: 'INTERNAL_ERROR' }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create',
    entity: 'stock_transfers', entityId: data.id,
    after: { fromLocationId, toLocationId, stockItemId, quantity, gradeId, lotNo, date },
  })
  return { success: true, data }
}
