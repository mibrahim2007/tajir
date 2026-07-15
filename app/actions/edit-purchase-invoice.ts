'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { normalizeMultiplyBy, isYarnItemType } from '@/lib/yarn'
import { isPolyesterItemType, computeQtyLbs } from '@/lib/polyester'
import type { ActionResult } from '@/lib/types'

const lineSchema = z.object({
  stockItemId: z.string().uuid('Invalid stock item'),
  quantity:    z.number().positive('Quantity must be positive'),
  rate:        z.number().positive('Rate must be positive'),
  discountPct: z.number().min(0).max(100).default(0),
  yarnType:    z.string().optional().nullable(),
  yarnWeight:  z.coerce.number().min(0).optional().nullable(),
  multiplyBy:  z.coerce.number().positive().optional().nullable(),
  nosCarton:       z.coerce.number().min(0).optional().nullable(),
  weightPerCarton: z.coerce.number().min(0).optional().nullable(),
})

const schema = z.object({
  invoiceId:    z.string().uuid('Invalid invoice'),
  supplierId:   z.string().uuid('Invalid supplier'),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.coerce.number().positive().default(1),
  advancePaid:  z.coerce.number().min(0).default(0),
  locationId:   z.string().uuid('Location is required'),
  notes:        z.string().optional(),
  lines:        z.array(lineSchema).min(1, 'Add at least one item'),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD transactions', path: ['exchangeRate'] },
)

export type EditPurchaseInvoiceInput = z.infer<typeof schema>

export async function editPurchaseInvoiceAction(
  input: unknown,
): Promise<ActionResult<{ invoiceId: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only the Owner can edit invoices', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { invoiceId, supplierId, date, currencyCode, exchangeRate, advancePaid, locationId, notes, lines } = parsed.data
  const admin = createAdminClient()
  const er = currencyCode === 'USD' ? exchangeRate : 1

  // Existing lines for this invoice — the basis for reversing inventory & GL.
  const { data: existingLines } = await admin
    .from('purchase_orders')
    .select('id, serial_number, stock_item_id, quantity')
    .eq('invoice_id', invoiceId)
    .eq('tenant_id', tenantId)

  if (!existingLines || existingLines.length === 0) {
    return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' }
  }

  const oldIds = existingLines.map((l) => l.id)

  // A returned line is FK-referenced by purchase_returns and can't be replaced.
  const { data: returnRefs } = await admin
    .from('purchase_returns')
    .select('id')
    .in('purchase_order_id', oldIds)
    .limit(1)
  if (returnRefs && returnRefs.length > 0) {
    return {
      success: false,
      error: 'This invoice has purchase returns recorded against it, so it can no longer be edited. Reverse the return first, then edit.',
      code: 'HAS_RETURNS',
    }
  }

  const serialNumber = existingLines[0].serial_number

  // Old vs new quantity per item.
  const oldQtyByItem = new Map<string, number>()
  for (const l of existingLines) oldQtyByItem.set(l.stock_item_id, (oldQtyByItem.get(l.stock_item_id) ?? 0) + l.quantity)
  const newQtyByItem = new Map<string, number>()
  for (const l of lines) newQtyByItem.set(l.stockItemId, (newQtyByItem.get(l.stockItemId) ?? 0) + l.quantity)

  // Net stock delta per item (purchases add stock): new − old. Block if reversing
  // the old quantity while a smaller new quantity would drive stock negative
  // (e.g. some was already sold/consumed since the purchase).
  const stockIds = [...new Set([...oldQtyByItem.keys(), ...newQtyByItem.keys()])]
  const { data: lots } = await admin
    .from('inventory_lots').select('id, current_quantity, item_type_id').eq('tenant_id', tenantId).in('id', stockIds)
  const currentByItem = new Map((lots ?? []).map((l) => [l.id, l.current_quantity]))
  for (const itemId of stockIds) {
    const delta = (newQtyByItem.get(itemId) ?? 0) - (oldQtyByItem.get(itemId) ?? 0)
    if ((currentByItem.get(itemId) ?? 0) + delta < 0) {
      return { success: false, error: 'Cannot save: the change would drive one or more items to negative stock.', code: 'INSUFFICIENT_STOCK' }
    }
  }

  // Resolve which new-line items are yarn / polyester (by their type name).
  const typeIds = [...new Set((lots ?? []).map((l) => l.item_type_id).filter(Boolean) as string[])]
  const { data: itemTypes } = typeIds.length
    ? await admin.from('item_types').select('id, name').eq('tenant_id', tenantId).in('id', typeIds)
    : { data: [] as { id: string; name: string }[] }
  const yarnTypeIds = new Set((itemTypes ?? []).filter((t) => isYarnItemType(t.name)).map((t) => t.id))
  const polyTypeIds = new Set((itemTypes ?? []).filter((t) => isPolyesterItemType(t.name)).map((t) => t.id))
  const typeByLot = new Map((lots ?? []).map((l) => [l.id, l.item_type_id]))
  const isYarn = (itemId: string) => { const t = typeByLot.get(itemId); return !!t && yarnTypeIds.has(t) }
  const isPolyester = (itemId: string) => { const t = typeByLot.get(itemId); return !!t && polyTypeIds.has(t) }

  // Insert the new lines FIRST (same invoice_id & serial) so the old rows stay
  // intact if an insert fails; only then delete the old rows.
  const createdOrders: { id: string; stockItemId: string; pkrEquivalent: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const yarn = isYarn(line.stockItemId)
    const poly = isPolyester(line.stockItemId)
    const multiplyBy = yarn ? normalizeMultiplyBy(line.multiplyBy) : 1
    const effectiveRate = line.rate * (1 - (line.discountPct || 0) / 100)
    const qtyLbs = poly ? computeQtyLbs(line.nosCarton, line.weightPerCarton) : null
    const pkrEquivalent = poly ? (qtyLbs ?? 0) * effectiveRate * er : line.quantity * effectiveRate * er * multiplyBy

    const { data: order, error } = await admin.from('purchase_orders').insert({
      tenant_id:      tenantId,
      serial_number:  serialNumber,
      supplier_id:    supplierId,
      stock_item_id:  line.stockItemId,
      quantity:       line.quantity,
      rate:           effectiveRate,
      currency_code:  currencyCode,
      exchange_rate:  exchangeRate,
      pkr_equivalent: pkrEquivalent,
      advance_paid:   i === 0 ? advancePaid : 0,
      date,
      yarn_type:      yarn ? (line.yarnType?.trim() || null) : null,
      yarn_weight:    yarn ? (line.yarnWeight ?? null) : null,
      multiply_by:    multiplyBy,
      nos_carton:        poly ? (line.nosCarton ?? null) : null,
      weight_per_carton: poly ? (line.weightPerCarton ?? null) : null,
      qty_lbs:           poly ? qtyLbs : null,
      location_id:    locationId,
      invoice_id:     invoiceId,
      confirmed_at:   new Date().toISOString(),
    }).select('id').single()

    if (error || !order) {
      if (createdOrders.length > 0) await admin.from('purchase_orders').delete().in('id', createdOrders.map((o) => o.id))
      return { success: false, error: 'Failed to update invoice', code: 'INTERNAL_ERROR' }
    }
    createdOrders.push({ id: order.id, stockItemId: line.stockItemId, pkrEquivalent })
  }

  // Remove the old rows now that the replacements exist. If this fails (e.g. a
  // row is still FK-referenced), roll back the new inserts.
  const { error: deleteErr } = await admin
    .from('purchase_orders').delete().in('id', oldIds).eq('tenant_id', tenantId)
  if (deleteErr) {
    await admin.from('purchase_orders').delete().in('id', createdOrders.map((o) => o.id))
    return { success: false, error: 'Could not update this invoice — its lines are referenced by another record. No changes were made.', code: 'INTERNAL_ERROR' }
  }

  // Net inventory adjustment per item: purchases add stock, so delta = new − old.
  for (const itemId of stockIds) {
    const delta = (newQtyByItem.get(itemId) ?? 0) - (oldQtyByItem.get(itemId) ?? 0)
    if (delta !== 0) await admin.rpc('adjust_inventory_quantity', { p_lot_id: itemId, p_delta: delta })
  }

  // Re-post the GL entry with the new totals, keeping the voucher stable.
  const totalPKR = createdOrders.reduce((s, o) => s + o.pkrEquivalent, 0)

  const { data: oldEntry } = await admin
    .from('tajir_journal_entries')
    .select('id, voucher_number')
    .eq('source_type', 'purchase_invoice')
    .eq('source_id', invoiceId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (oldEntry) {
    await admin.from('tajir_journal_entry_lines').delete().eq('journal_entry_id', oldEntry.id)
    await admin.from('tajir_journal_entries').delete().eq('id', oldEntry.id)
  }

  await postJournalEntry({
    tenantId, date, description: 'Purchase Invoice', reference: serialNumber ?? undefined,
    sourceType: 'purchase_invoice', sourceId: invoiceId, prefix: 'PI',
    voucherNumber: oldEntry?.voucher_number ?? undefined,
    lines: [
      ...createdOrders.map((o) => ({ accountSystemKey: 'inventory', debit: o.pkrEquivalent, credit: 0, stockItemId: o.stockItemId })),
      { accountSystemKey: 'accounts_payable', debit: 0, credit: totalPKR, supplierId },
    ],
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'update',
    entity: 'purchase_orders', entityId: invoiceId,
    before: { lineCount: existingLines.length },
    after: { supplierId, date, currencyCode, totalPKR, lineCount: lines.length, notes },
  })

  revalidatePath('/purchases')
  return { success: true, data: { invoiceId } }
}
