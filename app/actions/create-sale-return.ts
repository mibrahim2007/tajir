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

  const { user, tenantId } = await requireAuth()

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { saleOrderId, customerId, stockItemId, quantity, rate, currencyCode, exchangeRate, date, reason } = parsed.data
  const pkrEquivalent = quantity * rate * (currencyCode === 'USD' ? exchangeRate : 1)

  const admin = createAdminClient()

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
