'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
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

  const { purchaseOrderId, supplierId, stockItemId, quantity, rate, currencyCode, exchangeRate, date, reason } = parsed.data
  const pkrEquivalent = quantity * rate * (currencyCode === 'USD' ? exchangeRate : 1)

  const admin = createAdminClient()

  const { data: ret, error: insertError } = await admin
    .from('purchase_returns')
    .insert({
      tenant_id:         tenantId,
      purchase_order_id: purchaseOrderId ?? null,
      supplier_id:       supplierId,
      stock_item_id:     stockItemId,
      quantity:          String(quantity),
      rate:              String(rate),
      currency_code:     currencyCode,
      exchange_rate:     String(exchangeRate),
      pkr_equivalent:    String(pkrEquivalent),
      date,
      reason:            reason ?? null,
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
