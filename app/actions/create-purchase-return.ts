'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { nextDocumentSerial } from '@/lib/serials/next-serial'
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

  const { purchaseOrderId, supplierId, stockItemId, quantity, rate, currencyCode, exchangeRate, date, reason, locationId } = parsed.data
  const pkrEquivalent = quantity * rate * (currencyCode === 'USD' ? exchangeRate : 1)

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
    .select('current_quantity')
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
    })
    .select('id')
    .single()

  if (insertError || !ret) {
    return { success: false, error: 'Failed to create purchase return', code: 'INTERNAL_ERROR' }
  }

  // Decrement inventory (goods going back to supplier)
  await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: -quantity })

  // Auto-post GL: DR Accounts Payable, CR Stock in Trade
  await postJournalEntry({
    tenantId,
    date,
    description:  `Purchase Return${reason ? ` — ${reason}` : ''}`,
    sourceType:   'purchase_return',
    sourceId:     ret.id,
    prefix:       'PR',
    lines: [
      { accountSystemKey: 'accounts_payable', debit: pkrEquivalent, credit: 0, supplierId },
      { accountSystemKey: 'inventory',        debit: 0, credit: pkrEquivalent, stockItemId },
    ],
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create',
    entity: 'purchase_returns', entityId: ret.id,
    after: { supplierId, stockItemId, quantity, rate, currencyCode, pkrEquivalent, date, reason },
  })

  return { success: true, data: ret }
}
