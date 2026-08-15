'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { nextDocumentSerial } from '@/lib/serials/next-serial'
import { normalizeMultiplyBy } from '@/lib/yarn'
import { checkReturnLimit } from '@/lib/purchases/return-limit'
import { glCreateFailed } from '@/lib/accounting/gl-failure'
import {
  resolveCommissionClawback,
  clawbackJournalLines,
  syncCommissionClawback,
} from '@/lib/agents/clawback'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  purchaseOrderId: z.string().uuid().optional(),
  supplierId:      z.string().uuid('Invalid supplier'),
  stockItemId:     z.string().uuid('Invalid stock item'),
  quantity:        z.coerce.number().positive('Quantity must be positive'),
  rate:            z.coerce.number().positive('Rate must be positive'),
  currencyCode:    z.enum(['PKR', 'USD']),
  exchangeRate:    z.coerce.number().positive().default(1),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  reason:          z.string().optional(),
  locationId:      z.string().uuid().optional(),
  yarnType:        z.string().optional().nullable(),
  yarnWeight:      z.coerce.number().min(0).optional().nullable(),
  multiplyBy:      z.coerce.number().positive().optional().nullable(),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD transactions', path: ['exchangeRate'] },
)

export type CreatePurchaseReturnInput = z.infer<typeof schema>

export async function createPurchaseReturnAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, tenantId } = await requireAuth()

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { purchaseOrderId, supplierId, stockItemId, quantity, rate, currencyCode, exchangeRate, date, reason, locationId, yarnType, yarnWeight, multiplyBy: rawMultiplyBy } = parsed.data

  const admin = createAdminClient()

  /* Block if chart of accounts has not been configured */
  const { count: coaCount } = await admin
    .from('chart_of_accounts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (!coaCount) {
    return { success: false, error: 'Chart of accounts is not set up. Go to Accounts and configure it before recording purchase returns.', code: 'COA_NOT_CONFIGURED' }
  }

  /* Guard: purchase return removes goods from stock — block if it would go negative */
  const { data: lot } = await admin
    .from('inventory_lots')
    .select('current_quantity, item_type_id')
    .eq('id', stockItemId)
    .eq('tenant_id', tenantId)
    .single()
  const available = lot?.current_quantity  ?? 0
  if (available - quantity < 0) {
    return {
      success: false,
      error: `Insufficient stock: only ${available.toLocaleString()} units available. Cannot return ${quantity.toLocaleString()} units — this would result in negative stock.`,
      code: 'INSUFFICIENT_STOCK',
    }
  }

  /*
   * Guard: a purchase order cannot be returned more than it was bought.
   *
   * The stock check above is not enough. It asks whether enough stock exists
   * to remove, which says nothing about the order being returned against — so
   * the same PO could be returned twice, or returned for more than it ever
   * contained, as long as other stock of that item happened to be on hand.
   * That is how PO-2026-0016 ended up with 28,000 returned against a 15,000
   * purchase, and it makes the supplier return rate exceed 100%.
   */
  if (purchaseOrderId) {
    const [{ data: po }, { data: priorReturns }] = await Promise.all([
      admin
        .from('purchase_orders')
        .select('quantity, serial_number')
        .eq('id', purchaseOrderId)
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      admin
        .from('purchase_returns')
        .select('quantity')
        .eq('purchase_order_id', purchaseOrderId)
        .eq('tenant_id', tenantId),
    ])

    if (po) {
      const purchased = Number(po.quantity ?? 0)
      const alreadyReturned = (priorReturns ?? []).reduce((s, r) => s + Number(r.quantity ?? 0), 0)
      const limit = checkReturnLimit({ purchased, alreadyReturned, quantity })

      if (!limit.ok) {
        const label = po.serial_number ? ` ${po.serial_number}` : ''
        return {
          success: false,
          error: limit.reason === 'fully_returned'
            ? `Purchase order${label} has already been fully returned (${alreadyReturned.toLocaleString()} of ${purchased.toLocaleString()}). There is nothing left to return against it.`
            : `Only ${limit.remaining.toLocaleString()} of the ${purchased.toLocaleString()} bought on purchase order${label} is left to return — ${alreadyReturned.toLocaleString()} already has been. Cannot return ${quantity.toLocaleString()}.`,
          code: 'EXCEEDS_PURCHASED',
        }
      }
    }
  }

  // Yarn lines (Item Type "Yarn") carry a multiplier that scales the money amount.
  let isYarn = false
  if (lot?.item_type_id) {
    const { data: itemType } = await admin
      .from('item_types').select('name').eq('id', lot.item_type_id).eq('tenant_id', tenantId).maybeSingle()
    isYarn = (itemType?.name ?? '').trim().toLowerCase() === 'yarn'
  }
  const multiplyBy = isYarn ? normalizeMultiplyBy(rawMultiplyBy) : 1
  const pkrEquivalent = quantity * rate * (currencyCode === 'USD' ? exchangeRate : 1) * multiplyBy

  const serialNumber = await nextDocumentSerial(admin, tenantId, 'purchase_return', date)

  const { data: ret, error: insertError } = await admin
    .from('purchase_returns')
    .insert({
      tenant_id:         tenantId,
      serial_number:     serialNumber,
      purchase_order_id: purchaseOrderId ?? null,
      supplier_id:       supplierId,
      stock_item_id:     stockItemId,
      quantity:          quantity,
      rate:              rate,
      currency_code:     currencyCode,
      exchange_rate:     exchangeRate,
      pkr_equivalent:    pkrEquivalent,
      date,
      reason:            reason ?? null,
      location_id:       locationId ?? null,
      yarn_type:         isYarn ? (yarnType?.trim() || null) : null,
      yarn_weight:       isYarn ? (yarnWeight ?? null) : null,
      multiply_by:       multiplyBy,
    })
    .select('id')
    .single()

  if (insertError || !ret) {
    return { success: false, error: 'Failed to create purchase return', code: 'INTERNAL_ERROR' }
  }

  // Decrement inventory (goods going back to supplier)
  await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: -quantity })

  // Goods going back to the supplier undo the trade the broker arranged, so the
  // commission on them comes off their payable. Read from the rate stored on
  // the original accrual and capped at what was actually earned.
  const clawbackResolved = await resolveCommissionClawback(admin, tenantId, {
    side: 'purchase',
    orderId: purchaseOrderId,
    returnedValue: pkrEquivalent,
    returnedQuantity: quantity,
  })
  if (!clawbackResolved.ok) {
    await admin.from('purchase_returns').delete().eq('id', ret.id)
    await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: quantity })
    return { success: false, error: clawbackResolved.error, code: 'INTERNAL_ERROR' }
  }
  const clawback = clawbackResolved.clawback

  // Auto-post GL: DR Accounts Payable, CR Stock in Trade
  const posted = await postJournalEntry({
    tenantId,
    date,
    description:  'Purchase Return',
    reference:    serialNumber,
    sourceType:   'purchase_return',
    sourceId:     ret.id,
    prefix:       'PR',
    lines: [
      { accountSystemKey: 'accounts_payable', debit: pkrEquivalent, credit: 0, supplierId },
      { accountSystemKey: 'inventory',        debit: 0, credit: pkrEquivalent, stockItemId },
      // Commission reversal: DR Agent Commission Payable / CR Commission
      // Expense. Rides on the return's own entry, so deleting the return
      // removes the reversal with it.
      ...clawbackJournalLines(clawback),
    ],
  })
  // The return already removed stock; put it back on failure.
  if (!posted.ok) {
    await admin.from('purchase_returns').delete().eq('id', ret.id)
    await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: quantity })
    return glCreateFailed(posted.message)
  }

  await syncCommissionClawback(admin, {
    tenantId, clawback, sourceType: 'purchase_return', sourceId: ret.id,
    documentSerial: serialNumber, partyName: null, date,
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create',
    entity: 'purchase_returns', entityId: ret.id,
    after: {
      supplierId, stockItemId, quantity, rate, currencyCode, pkrEquivalent, date, reason,
      commissionReversed: clawback?.amount ?? 0,
    },
  })

  return { success: true, data: ret }
}
