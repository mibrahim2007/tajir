'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  id:           z.string().uuid(),
  supplierId:   z.string().uuid(),
  stockItemId:  z.string().uuid(),
  quantity:     z.coerce.number().positive(),
  rate:         z.coerce.number().positive(),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.coerce.number().positive().default(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason:       z.string().optional(),
})

export async function editPurchaseReturnAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, supplierId, stockItemId, quantity, rate, currencyCode, exchangeRate, date, reason } = parsed.data
  const pkrEquivalent = quantity * rate * (currencyCode === 'USD' ? exchangeRate : 1)

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('purchase_returns')
    .select('quantity, rate, pkr_equivalent, date, reason, stock_item_id, supplier_id, currency_code')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!existing) return { success: false, error: 'Purchase return not found', code: 'NOT_FOUND' }

  const oldQty = parseFloat(existing.quantity)
  // Purchase return reduces stock; increasing qty removes more stock
  const extraRemoval = quantity - oldQty
  if (extraRemoval > 0) {
    const { data: lot } = await admin
      .from('inventory_lots')
      .select('current_quantity')
      .eq('id', stockItemId)
      .eq('tenant_id', tenantId)
      .single()
    const available = parseFloat(lot?.current_quantity ?? '0')
    if (available < extraRemoval) {
      return {
        success: false,
        error: `Insufficient stock: only ${available.toLocaleString()} units available. Cannot increase return by ${extraRemoval.toLocaleString()} units.`,
        code: 'INSUFFICIENT_STOCK',
      }
    }
  }

  const { error } = await admin
    .from('purchase_returns')
    .update({
      supplier_id:    supplierId,
      stock_item_id:  stockItemId,
      quantity:       String(quantity),
      rate:           String(rate),
      currency_code:  currencyCode,
      exchange_rate:  String(exchangeRate),
      pkr_equivalent: String(pkrEquivalent),
      date,
      reason:         reason ?? null,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update purchase return', code: 'INTERNAL_ERROR' }

  // Adjust inventory: net delta = old - new (positive = stock restored, negative = more removed)
  const qtyDelta = oldQty - quantity
  if (qtyDelta !== 0) {
    await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: qtyDelta })
  }

  // Replace GL entry
  const { data: glEntry } = await admin
    .from('tajir_journal_entries')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('source_type', 'purchase_return')
    .eq('source_id', id)
    .single()
  if (glEntry) await admin.from('tajir_journal_entries').delete().eq('id', glEntry.id)

  await postJournalEntry({
    tenantId, date,
    description: `Purchase Return${reason ? ` — ${reason}` : ''}`,
    sourceType: 'purchase_return',
    sourceId: id,
    prefix: 'PR',
    lines: [
      { accountSystemKey: 'accounts_payable', debit: pkrEquivalent, credit: 0, supplierId },
      { accountSystemKey: 'inventory',        debit: 0, credit: pkrEquivalent, stockItemId },
    ],
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'update',
    entity: 'purchase_returns', entityId: id,
    before: { quantity: existing.quantity, rate: existing.rate, date: existing.date, reason: existing.reason },
    after: { quantity, rate, date, reason },
  })

  return { success: true, data: undefined }
}
