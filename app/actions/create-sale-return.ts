'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  saleOrderId:  z.string().uuid().optional(),
  customerId:   z.string().uuid('Invalid customer'),
  stockItemId:  z.string().uuid('Invalid stock item'),
  quantity:     z.coerce.number().positive('Quantity must be positive'),
  rate:         z.coerce.number().positive('Rate must be positive'),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.coerce.number().positive().default(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  reason:       z.string().optional(),
  locationId:   z.string().uuid().optional(),
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

  const { saleOrderId, customerId, stockItemId, quantity, rate, currencyCode, exchangeRate, date, reason, locationId } = parsed.data
  const pkrEquivalent = quantity * rate * (currencyCode === 'USD' ? exchangeRate : 1)

  const admin = createAdminClient()

  /* Validate quantity does not exceed original sale if saleOrderId is provided */
  if (saleOrderId) {
    const { data: originalSale } = await admin
      .from('sales_orders')
      .select('quantity')
      .eq('id', saleOrderId)
      .eq('tenant_id', tenantId)
      .single()

    if (originalSale) {
      const { data: existingReturns } = await admin
        .from('sale_returns')
        .select('quantity')
        .eq('sale_order_id', saleOrderId)
        .eq('tenant_id', tenantId)

      const alreadyReturned = (existingReturns ?? []).reduce((s, r) => s + parseFloat(r.quantity), 0)
      const originalQty = parseFloat(originalSale.quantity)

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

  const { data: ret, error: insertError } = await admin
    .from('sale_returns')
    .insert({
      tenant_id:     tenantId,
      sale_order_id: saleOrderId ?? null,
      customer_id:   customerId,
      stock_item_id: stockItemId,
      quantity:      String(quantity),
      rate:          String(rate),
      currency_code: currencyCode,
      exchange_rate: String(exchangeRate),
      pkr_equivalent: String(pkrEquivalent),
      date,
      reason:        reason ?? null,
      location_id:   locationId ?? null,
    })
    .select('id')
    .single()

  if (insertError || !ret) {
    return { success: false, error: 'Failed to create sale return', code: 'INTERNAL_ERROR' }
  }

  // Increment inventory (goods returned to stock)
  await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: quantity })

  // Auto-post GL:
  //   DR Sales Returns & Allowances (contra-revenue), CR Accounts Receivable
  //   DR Stock in Trade, CR Cost of Goods Sold
  await postJournalEntry({
    tenantId,
    date,
    description:  `Sale Return${reason ? ` — ${reason}` : ''}`,
    sourceType:   'sale_return',
    sourceId:     ret.id,
    prefix:       'SR',
    lines: [
      { accountSystemKey: 'sales_returns_contra',  debit: pkrEquivalent, credit: 0, customerId },
      { accountSystemKey: 'accounts_receivable',   debit: 0, credit: pkrEquivalent, customerId },
      { accountSystemKey: 'inventory',             debit: pkrEquivalent, credit: 0, stockItemId },
      { accountSystemKey: 'cogs',                  debit: 0, credit: pkrEquivalent, stockItemId },
    ],
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create',
    entity: 'sale_returns', entityId: ret.id,
    after: { customerId, stockItemId, quantity, rate, currencyCode, pkrEquivalent, date, reason },
  })

  return { success: true, data: ret }
}
