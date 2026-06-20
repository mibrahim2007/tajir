'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  customerId:     z.string().uuid('Invalid customer'),
  stockItemId:    z.string().uuid('Invalid stock item'),
  quantity:       z.coerce.number().positive('Quantity must be positive'),
  rate:           z.coerce.number().positive('Rate must be positive'),
  currencyCode:   z.enum(['PKR', 'USD']),
  exchangeRate:   z.coerce.number().positive().default(1),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  allowOversell:  z.boolean().optional(),
  locationId:     z.string().uuid().optional(),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD transactions', path: ['exchangeRate'] },
)

export type CreateSaleInput = z.infer<typeof schema>

export async function createSaleOrderAction(input: unknown): Promise<
  ActionResult<{ id: string }> | { success: false; code: 'OVERSELL'; available: number; requested: number }
> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, role, tenantId } = await requireAuth()

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { customerId, stockItemId, quantity, rate, currencyCode, exchangeRate, date, paymentDueDate, allowOversell, locationId } = parsed.data
  const pkrEquivalent = quantity * rate * (currencyCode === 'USD' ? exchangeRate : 1)

  const admin = createAdminClient()

  // Check available stock
  const { data: lot } = await admin
    .from('inventory_lots')
    .select('current_quantity')
    .eq('id', stockItemId)
    .eq('tenant_id', tenantId)
    .single()

  const available = lot ? parseFloat(lot.current_quantity) : 0

  if (available < quantity && !allowOversell) {
    return { success: false as const, error: 'Insufficient stock', code: 'OVERSELL' as const, available, requested: quantity }
  }

  if (available < quantity && allowOversell && role === 'assistant') {
    return { success: false, error: 'Only the Owner can override stock limits', code: 'UNAUTHORIZED' }
  }

  const { data: order, error: insertError } = await admin
    .from('sales_orders')
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      stock_item_id: stockItemId,
      quantity: String(quantity),
      rate: String(rate),
      currency_code: currencyCode,
      exchange_rate: String(exchangeRate),
      pkr_equivalent: String(pkrEquivalent),
      date,
      payment_due_date: paymentDueDate ?? null,
      location_id:     locationId ?? null,
      confirmed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError || !order) {
    return { success: false, error: 'Failed to create sale', code: 'INTERNAL_ERROR' }
  }

  // Decrement inventory quantity
  await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: -quantity })

  // Auto-post GL: DR Accounts Receivable, CR Sales Revenue + DR COGS, CR Inventory
  await postJournalEntry({
    tenantId, date, description: 'Sale Invoice', sourceType: 'sale_order', sourceId: order.id, prefix: 'SI',
    lines: [
      { accountSystemKey: 'accounts_receivable', debit: pkrEquivalent, credit: 0, customerId },
      { accountSystemKey: 'sales_revenue',       debit: 0, credit: pkrEquivalent, customerId },
      { accountSystemKey: 'cogs',                debit: pkrEquivalent, credit: 0, stockItemId },
      { accountSystemKey: 'inventory',           debit: 0, credit: pkrEquivalent, stockItemId },
    ],
  })

  await createAuditEntry({ tenantId, userId: user.id, action: 'create', entity: 'sales_orders', entityId: order.id, after: { customerId, stockItemId, quantity, rate, currencyCode, pkrEquivalent, date } })

  return { success: true, data: order }
}
