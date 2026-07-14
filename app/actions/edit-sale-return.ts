'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { normalizeMultiplyBy } from '@/lib/yarn'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  id:           z.string().uuid(),
  customerId:   z.string().uuid(),
  stockItemId:  z.string().uuid(),
  quantity:     z.coerce.number().positive(),
  rate:         z.coerce.number().positive(),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.coerce.number().positive().default(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason:       z.string().optional(),
  locationId:   z.string().uuid().optional().or(z.literal('')),
  yarnType:     z.string().optional().nullable(),
  yarnWeight:   z.coerce.number().min(0).optional().nullable(),
  multiplyBy:   z.coerce.number().positive().optional().nullable(),
})

export async function editSaleReturnAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, customerId, stockItemId, quantity, rate, currencyCode, exchangeRate, date, reason, locationId, yarnType, yarnWeight, multiplyBy: rawMultiplyBy } = parsed.data

  const admin = createAdminClient()

  // Yarn items (Item Type "Yarn") carry a multiplier that scales the money amount.
  const { data: itemLot } = await admin
    .from('inventory_lots').select('item_type_id').eq('id', stockItemId).eq('tenant_id', tenantId).maybeSingle()
  let isYarn = false
  if (itemLot?.item_type_id) {
    const { data: itemType } = await admin
      .from('item_types').select('name').eq('id', itemLot.item_type_id).eq('tenant_id', tenantId).maybeSingle()
    isYarn = (itemType?.name ?? '').trim().toLowerCase() === 'yarn'
  }
  const multiplyBy = isYarn ? normalizeMultiplyBy(rawMultiplyBy) : 1
  const pkrEquivalent = quantity * rate * (currencyCode === 'USD' ? exchangeRate : 1) * multiplyBy

  const { data: existing } = await admin
    .from('sale_returns')
    .select('quantity, rate, pkr_equivalent, date, reason, stock_item_id, customer_id, currency_code, serial_number')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!existing) return { success: false, error: 'Sale return not found', code: 'NOT_FOUND' }

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
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update sale return', code: 'INTERNAL_ERROR' }

  // Adjust inventory: net delta = new - old (positive = more goods returned, negative = fewer)
  const qtyDelta = quantity - oldQty
  if (qtyDelta !== 0) {
    await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: qtyDelta })
  }

  // Replace GL entry
  const { data: glEntry } = await admin
    .from('tajir_journal_entries')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('source_type', 'sale_return')
    .eq('source_id', id)
    .single()
  if (glEntry) await admin.from('tajir_journal_entries').delete().eq('id', glEntry.id)

  await postJournalEntry({
    tenantId, date,
    description: 'Sale Return',
    reference: existing.serial_number ?? undefined,
    sourceType: 'sale_return',
    sourceId: id,
    prefix: 'SR',
    lines: [
      { accountSystemKey: 'sales_returns_contra', debit: pkrEquivalent, credit: 0, customerId },
      { accountSystemKey: 'accounts_receivable',  debit: 0, credit: pkrEquivalent, customerId },
      { accountSystemKey: 'inventory',            debit: pkrEquivalent, credit: 0, stockItemId },
      { accountSystemKey: 'cogs',                 debit: 0, credit: pkrEquivalent, stockItemId },
    ],
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'update',
    entity: 'sale_returns', entityId: id,
    before: { quantity: existing.quantity, rate: existing.rate, date: existing.date, reason: existing.reason },
    after: { quantity, rate, date, reason },
  })

  return { success: true, data: undefined }
}
