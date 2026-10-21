'use server'

import { z } from 'zod'
import { documentDateSchema } from '@/lib/validation/document-date'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { nextDocumentSerial } from '@/lib/serials/next-serial'
import { loadCostReceipts, costLines, round2 } from '@/lib/inventory/costing'
import { measureReturnLine, returnLineFields } from '@/lib/inventory/return-line'
import { glCreateFailed } from '@/lib/accounting/gl-failure'
import {
  resolveCommissionClawback,
  clawbackJournalLines,
  syncCommissionClawback,
} from '@/lib/agents/clawback'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  saleOrderId:  z.string().uuid().optional(),
  customerId:   z.string().uuid('Invalid customer'),
  stockItemId:  z.string().uuid('Invalid stock item'),
  // Carton lines derive their quantity from Nos Carton × Weight on the server.
  quantity:     z.coerce.number().min(0).optional(),
  rate:         z.coerce.number().positive('Rate must be positive'),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.coerce.number().positive().default(1),
  date:         documentDateSchema,
  reason:       z.string().optional(),
  locationId:   z.string().uuid().optional(),
  yarnType:     z.string().optional().nullable(),
  yarnWeight:   z.coerce.number().min(0).optional().nullable(),
  multiplyBy:   z.coerce.number().positive().optional().nullable(),
  ...returnLineFields,
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD transactions', path: ['exchangeRate'] },
)

export type CreateSaleReturnInput = z.infer<typeof schema>

export async function createSaleReturnAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, role, tenantId } = await requireAuth()

  if (role !== 'owner') {
    return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }
  }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { saleOrderId, customerId, stockItemId, rate, currencyCode, exchangeRate, date, reason, locationId, yarnType, yarnWeight } = parsed.data

  const admin = createAdminClient()

  // The sale line this return is booked against, if any: its grade / lot are
  // the ones the goods carried.
  const { data: originalSale } = saleOrderId
    ? await admin
        .from('sales_orders')
        .select('quantity, grade_id, lot_no, weight_per_carton, cost_rate, rate_basis')
        .eq('id', saleOrderId)
        .eq('tenant_id', tenantId)
        .single()
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
    original:        originalSale,
  })
  if (!measured.ok) return { success: false, error: measured.error, code: 'VALIDATION_ERROR' }
  const { quantity, multiplyBy, isYarn, pkrEquivalent } = measured.line

  // Goods come back at the cost they went out at: the linked sale line's
  // cost_rate, else today's receipt cost for the lot / item (0073).
  let returnCostRate: number | null = originalSale?.cost_rate != null ? Number(originalSale.cost_rate) : null
  if (returnCostRate === null) {
    const costData = await loadCostReceipts(admin, tenantId, [stockItemId], date)
    returnCostRate = costLines(costData, [{
      stockItemId, gradeId: measured.line.gradeId, lotNo: measured.line.lotNo,
      trackGrade: measured.line.profile.trackGrade, trackLot: measured.line.profile.trackLot, quantity,
    }])[0].costRate
  }
  const returnCostAmount = returnCostRate === null ? 0 : round2(returnCostRate * quantity)

  /* Validate quantity does not exceed original sale if saleOrderId is provided */
  if (saleOrderId) {
    if (originalSale) {
      const { data: existingReturns } = await admin
        .from('sale_returns')
        .select('quantity')
        .eq('sale_order_id', saleOrderId)
        .eq('tenant_id', tenantId)

      const alreadyReturned = (existingReturns ?? []).reduce((s, r) => s + r.quantity, 0)
      const originalQty = originalSale.quantity

      if (alreadyReturned + quantity > originalQty) {
        const available = originalQty - alreadyReturned
        return {
          success: false,
          error: `Cannot return more than ${available.toLocaleString()} units — ${alreadyReturned.toLocaleString()} already returned against this sale`,
          code: 'OVER_RETURN',
        }
      }
    }
  }

  /* Block if chart of accounts has not been configured */
  const { count: coaCount } = await admin
    .from('chart_of_accounts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (!coaCount) {
    return { success: false, error: 'Chart of accounts is not set up. Go to Accounts and configure it before recording sale returns.', code: 'COA_NOT_CONFIGURED' }
  }

  const serialNumber = await nextDocumentSerial(admin, tenantId, 'sale_return', date)

  const { data: ret, error: insertError } = await admin
    .from('sale_returns')
    .insert({
      tenant_id:     tenantId,
      serial_number: serialNumber,
      sale_order_id: saleOrderId ?? null,
      customer_id:   customerId,
      stock_item_id: stockItemId,
      quantity:      quantity,
      rate:          rate,
      currency_code: currencyCode,
      exchange_rate: exchangeRate,
      pkr_equivalent: pkrEquivalent,
      date,
      reason:        reason ?? null,
      location_id:   locationId ?? null,
      yarn_type:     isYarn ? (yarnType?.trim() || null) : null,
      yarn_weight:   isYarn ? (yarnWeight ?? null) : null,
      multiply_by:   multiplyBy,
      nos_carton:        measured.line.nosCarton,
      weight_per_carton: measured.line.weightPerCarton,
      qty_lbs:           measured.line.qtyLbs,
      grade_id:          measured.line.gradeId,
      lot_no:            measured.line.lotNo,
      rate_basis:        measured.line.rateBasis,
      cost_rate:         returnCostRate,
      cost_amount:       returnCostAmount,
    })
    .select('id')
    .single()

  if (insertError || !ret) {
    return { success: false, error: 'Failed to create sale return', code: 'INTERNAL_ERROR' }
  }

  // Increment inventory (goods returned to stock)
  await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: quantity })

  // Goods that came back did not stay sold, so the broker's commission on them
  // comes off their payable. Computed from the rate stored on the original
  // accrual, and capped so cumulative returns can never reverse more than was
  // earned. Null when the return is not linked to an invoice line, the invoice
  // had no agent, or it accrued nothing.
  const clawbackResolved = await resolveCommissionClawback(admin, tenantId, {
    side: 'sale',
    orderId: saleOrderId,
    returnedValue: pkrEquivalent,
    returnedQuantity: quantity,
  })
  if (!clawbackResolved.ok) {
    await admin.from('sale_returns').delete().eq('id', ret.id)
    await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: -quantity })
    return { success: false, error: clawbackResolved.error, code: 'INTERNAL_ERROR' }
  }
  const clawback = clawbackResolved.clawback

  // Auto-post GL:
  //   DR Sales Returns & Allowances (contra-revenue), CR Accounts Receivable
  //   DR Stock in Trade, CR Cost of Goods Sold
  const posted = await postJournalEntry({
    tenantId,
    date,
    description:  'Sale Return',
    reference:    serialNumber,
    sourceType:   'sale_return',
    sourceId:     ret.id,
    prefix:       'SR',
    lines: [
      { accountSystemKey: 'sales_returns_contra',  debit: pkrEquivalent, credit: 0, customerId },
      { accountSystemKey: 'accounts_receivable',   debit: 0, credit: pkrEquivalent, customerId },
      // Stock back in at cost (0073), not at the sale amount.
      ...(returnCostAmount > 0 ? [
        { accountSystemKey: 'inventory',             debit: returnCostAmount, credit: 0, stockItemId },
        { accountSystemKey: 'cogs',                  debit: 0, credit: returnCostAmount, stockItemId },
      ] : []),
      // Commission reversal: DR Agent Commission Payable / CR Commission
      // Expense. Rides on the return's own entry, so deleting the return
      // removes the reversal with it.
      ...clawbackJournalLines(clawback),
    ],
  })
  // The return already added stock back; remove it again on failure.
  if (!posted.ok) {
    await admin.from('sale_returns').delete().eq('id', ret.id)
    await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: -quantity })
    return glCreateFailed(posted.message)
  }

  await syncCommissionClawback(admin, {
    tenantId, clawback, sourceType: 'sale_return', sourceId: ret.id,
    documentSerial: serialNumber, partyName: null, date,
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create',
    entity: 'sale_returns', entityId: ret.id,
    after: {
      customerId, stockItemId, quantity, rate, currencyCode, pkrEquivalent, date, reason,
      commissionReversed: clawback?.amount ?? 0,
    },
  })

  return { success: true, data: ret }
}
