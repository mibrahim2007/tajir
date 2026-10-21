'use server'

import { z } from 'zod'
import { documentDateSchema } from '@/lib/validation/document-date'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { repostJournalEntry } from '@/lib/accounting/repost-journal-entry'
import { loadCostReceipts, costLines, round2 } from '@/lib/inventory/costing'
import { normalizeFormula, tracksGradeLot } from '@/lib/item-formula'
import { measureReturnLine, returnLineFields, checkPositionStock } from '@/lib/inventory/return-line'
import { glEditFailed } from '@/lib/accounting/gl-failure'
import {
  resolveCommissionClawback,
  clawbackJournalLines,
  syncCommissionClawback,
} from '@/lib/agents/clawback'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  id:           z.string().uuid(),
  customerId:   z.string().uuid(),
  stockItemId:  z.string().uuid(),
  // Carton lines derive their quantity from Nos Carton × Weight on the server.
  quantity:     z.coerce.number().min(0).optional(),
  rate:         z.coerce.number().positive(),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.coerce.number().positive().default(1),
  date:         documentDateSchema,
  reason:       z.string().optional(),
  locationId:   z.string().uuid().optional().or(z.literal('')),
  yarnType:     z.string().optional().nullable(),
  yarnWeight:   z.coerce.number().min(0).optional().nullable(),
  multiplyBy:   z.coerce.number().positive().optional().nullable(),
  ...returnLineFields,
})

export async function editSaleReturnAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, customerId, stockItemId, rate, currencyCode, exchangeRate, date, reason, locationId, yarnType, yarnWeight } = parsed.data

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('sale_returns')
    .select('quantity, rate, pkr_equivalent, date, reason, stock_item_id, customer_id, currency_code, serial_number, sale_order_id, location_id, grade_id, lot_no, rate_basis')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!existing) return { success: false, error: 'Sale return not found', code: 'NOT_FOUND' }

  // A return booked against an invoice line keeps that line's grade / lot.
  const { data: originalLine } = existing.sale_order_id
    ? await admin
        .from('sales_orders')
        .select('grade_id, lot_no, weight_per_carton, cost_rate, rate_basis')
        .eq('id', existing.sale_order_id)
        .eq('tenant_id', tenantId)
        .maybeSingle()
    : { data: null }

  // Measured by the line's rate basis: carton lines derive quantity from
  // Nos Carton × Weight, yarn lines apply Multiply By.
  const measured = await measureReturnLine(admin, tenantId, {
    stockItemId,
    quantity:        parsed.data.quantity,
    rate,
    fx:              currencyCode === 'USD' ? exchangeRate : 1,
    multiplyBy:      parsed.data.multiplyBy,
    nosCarton:       parsed.data.nosCarton,
    weightPerCarton: parsed.data.weightPerCarton,
    gradeId:         parsed.data.gradeId,
    lotNo:           parsed.data.lotNo,
    rateBasis:       parsed.data.rateBasis,
    original:        originalLine,
  })
  if (!measured.ok) return { success: false, error: measured.error, code: 'VALIDATION_ERROR' }
  const { quantity, multiplyBy, isYarn, pkrEquivalent, profile } = measured.line

  // Goods come back at the cost they went out at: the linked sale line's
  // cost_rate, else today's receipt cost for the lot / item (0073).
  let returnCostRate: number | null = originalLine?.cost_rate != null ? Number(originalLine.cost_rate) : null
  if (returnCostRate === null) {
    const costData = await loadCostReceipts(admin, tenantId, [stockItemId], date)
    returnCostRate = costLines(costData, [{
      stockItemId, gradeId: measured.line.gradeId, lotNo: measured.line.lotNo,
      trackGrade: measured.line.profile.trackGrade, trackLot: measured.line.profile.trackLot, quantity,
    }])[0].costRate
  }
  const returnCostAmount = returnCostRate === null ? 0 : round2(returnCostRate * quantity)

  // The row as saved and as edited, as grade / lot stock positions.
  const oldPosition = {
    stockItemId: existing.stock_item_id, locationId: existing.location_id, gradeId: existing.grade_id,
    lotNo: existing.lot_no, quantity: existing.quantity,
    // The saved row is checked at the basis it was saved with.
    trackGrade: tracksGradeLot(normalizeFormula(existing.rate_basis)), trackLot: tracksGradeLot(normalizeFormula(existing.rate_basis)),
  }
  const newPosition = {
    stockItemId, locationId: locationId || null, gradeId: measured.line.gradeId,
    lotNo: measured.line.lotNo, quantity, trackGrade: profile.trackGrade, trackLot: profile.trackLot,
  }

  const oldQty = existing.quantity
  // Sale return adds stock; decreasing qty removes stock
  const stockRemoval = oldQty - quantity
  if (stockRemoval > 0) {
    const { data: lot } = await admin
      .from('inventory_lots')
      .select('current_quantity')
      .eq('id', stockItemId)
      .eq('tenant_id', tenantId)
      .single()
    const available = lot?.current_quantity  ?? 0
    if (available < stockRemoval) {
      return {
        success: false,
        error: `Insufficient stock: only ${available.toLocaleString()} units available. Reducing this return by ${stockRemoval.toLocaleString()} units would result in negative stock.`,
        code: 'INSUFFICIENT_STOCK',
      }
    }
  }

  // Guard: the edit takes the saved return back out of its grade / lot and
  // books the edited one in; the old position must still hold what it got.
  const positionCheck = await checkPositionStock(admin, tenantId, [oldPosition], [newPosition])
  if (!positionCheck.ok) return { success: false, error: positionCheck.error, code: 'INSUFFICIENT_STOCK' }

  const { error } = await admin
    .from('sale_returns')
    .update({
      customer_id:    customerId,
      stock_item_id:  stockItemId,
      quantity:       quantity,
      rate:           rate,
      currency_code:  currencyCode,
      exchange_rate:  exchangeRate,
      pkr_equivalent: pkrEquivalent,
      date,
      reason:         reason ?? null,
      location_id:    locationId || null,
      yarn_type:      isYarn ? (yarnType?.trim() || null) : null,
      yarn_weight:    isYarn ? (yarnWeight ?? null) : null,
      multiply_by:    multiplyBy,
      nos_carton:        measured.line.nosCarton,
      weight_per_carton: measured.line.weightPerCarton,
      qty_lbs:           measured.line.qtyLbs,
      grade_id:          measured.line.gradeId,
      lot_no:            measured.line.lotNo,
      rate_basis:        measured.line.rateBasis,
      cost_rate:         returnCostRate,
      cost_amount:       returnCostAmount,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update sale return', code: 'INTERNAL_ERROR' }

  // Adjust inventory: net delta = new - old (positive = more goods returned, negative = fewer)
  const qtyDelta = quantity - oldQty
  if (qtyDelta !== 0) {
    await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: qtyDelta })
  }

  // Re-derive the commission reversal from the edited quantities. `excludeReturnId`
  // keeps this return's own prior clawback out of the "already reversed" total,
  // which would otherwise make the edit measure itself and under-reverse.
  const clawbackResolved = await resolveCommissionClawback(admin, tenantId, {
    side: 'sale',
    orderId: existing.sale_order_id,
    returnedValue: pkrEquivalent,
    returnedQuantity: quantity,
    excludeReturnId: id,
  })
  if (!clawbackResolved.ok) return { success: false, error: clawbackResolved.error, code: 'INTERNAL_ERROR' }
  const clawback = clawbackResolved.clawback

  // Replace GL entry. The helper snapshots the previous one so a failed post
  // restores it, and it carries the original voucher number over.
  const posted = await repostJournalEntry({
    tenantId, date,
    description: 'Sale Return',
    reference: existing.serial_number ?? undefined,
    sourceType: 'sale_return',
    sourceId: id,
    prefix: 'SR',
    lines: [
      { accountSystemKey: 'sales_returns_contra', debit: pkrEquivalent, credit: 0, customerId },
      { accountSystemKey: 'accounts_receivable',  debit: 0, credit: pkrEquivalent, customerId },
      // Stock back in at cost (0073), not at the sale amount.
      ...(returnCostAmount > 0 ? [
        { accountSystemKey: 'inventory',            debit: returnCostAmount, credit: 0, stockItemId },
        { accountSystemKey: 'cogs',                 debit: 0, credit: returnCostAmount, stockItemId },
      ] : []),
      ...clawbackJournalLines(clawback),
    ],
  })
  if (!posted.ok) return glEditFailed(posted.message)

  // Restate (or clear) the clawback row now that the GL agrees with the edit.
  await syncCommissionClawback(admin, {
    tenantId, clawback, sourceType: 'sale_return', sourceId: id,
    documentSerial: existing.serial_number, partyName: null, date,
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'update',
    entity: 'sale_returns', entityId: id,
    before: { quantity: existing.quantity, rate: existing.rate, date: existing.date, reason: existing.reason },
    after: { quantity, rate, date, reason, commissionReversed: clawback?.amount ?? 0 },
  })

  return { success: true, data: undefined }
}
