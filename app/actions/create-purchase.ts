'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  supplierId:   z.string().uuid('Invalid supplier'),
  stockItemId:  z.string().uuid('Invalid stock item'),
  quantity:     z.coerce.number().positive('Quantity must be positive'),
  rate:         z.coerce.number().positive('Rate must be positive'),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.coerce.number().positive().default(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  advancePaid:  z.coerce.number().min(0).default(0),
  locationId:   z.string().uuid('Select a location'),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD transactions', path: ['exchangeRate'] },
)

export type CreatePurchaseInput = z.infer<typeof schema>

export async function createPurchaseAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, tenantId } = await requireAuth()

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { supplierId, stockItemId, quantity, rate, currencyCode, exchangeRate, date, advancePaid, locationId } = parsed.data
  const pkrEquivalent = quantity * rate * (currencyCode === 'USD' ? exchangeRate : 1)

  const admin = createAdminClient()

  const { data: order, error: insertError } = await admin
    .from('purchase_orders')
    .insert({
      tenant_id: tenantId,
      supplier_id: supplierId,
      stock_item_id: stockItemId,
      quantity: String(quantity),
      rate: String(rate),
      currency_code: currencyCode,
      exchange_rate: String(exchangeRate),
      pkr_equivalent: String(pkrEquivalent),
      advance_paid: String(advancePaid),
      date,
      location_id:  locationId,
      confirmed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError || !order) {
    return { success: false, error: 'Failed to create purchase', code: 'INTERNAL_ERROR' }
  }

  // Increment inventory quantity
  await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: quantity })

  // Auto-post GL: DR Inventory, CR Accounts Payable
  await postJournalEntry({
    tenantId, date, description: 'Purchase Invoice', sourceType: 'purchase_order', sourceId: order.id, prefix: 'PI',
    lines: [
      { accountSystemKey: 'inventory',        debit: pkrEquivalent, credit: 0, stockItemId },
      { accountSystemKey: 'accounts_payable', debit: 0, credit: pkrEquivalent, supplierId },
    ],
  })

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'create',
    entity: 'purchase_orders',
    entityId: order.id,
    after: { supplierId, stockItemId, quantity, rate, currencyCode, pkrEquivalent, date },
  })

  return { success: true, data: order }
}
