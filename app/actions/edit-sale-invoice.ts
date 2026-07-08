'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import type { ActionResult } from '@/lib/types'

const lineSchema = z.object({
  stockItemId: z.string().uuid('Invalid stock item'),
  quantity:    z.number().positive('Quantity must be positive'),
  rate:        z.number().positive('Rate must be positive'),
  discountPct: z.number().min(0).max(100).default(0),
})

const schema = z.object({
  invoiceId:      z.string().uuid('Invalid invoice'),
  customerId:     z.string().uuid('Invalid customer'),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  currencyCode:   z.enum(['PKR', 'USD']),
  exchangeRate:   z.coerce.number().positive().default(1),
  locationId:     z.string().uuid().optional(),
  notes:          z.string().optional(),
  allowOversell:  z.boolean().optional(),
  lines:          z.array(lineSchema).min(1, 'Add at least one item'),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD transactions', path: ['exchangeRate'] },
)

export type EditSaleInvoiceInput = z.infer<typeof schema>

type OversellInfo = { stockItemId: string; available: number; requested: number }

export async function editSaleInvoiceAction(
  input: unknown
): Promise<
  | ActionResult<{ invoiceId: string }>
  | { success: false; code: 'OVERSELL'; oversells: OversellInfo[] }
> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only the Owner can edit invoices', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { invoiceId, customerId, date, paymentDueDate, currencyCode, exchangeRate, locationId, notes, lines } = parsed.data
  const admin = createAdminClient()

  // Existing lines for this invoice — the basis for reversing inventory & GL.
  const { data: existingLines } = await admin
    .from('sales_orders')
    .select('id, serial_number, stock_item_id, quantity')
    .eq('invoice_id', invoiceId)
    .eq('tenant_id', tenantId)

  if (!existingLines || existingLines.length === 0) {
    return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' }
  }

  const oldIds = existingLines.map((l) => l.id)

  // A returned line is FK-referenced by sale_returns and can't be replaced.
  // Editing such an invoice would corrupt the return linkage, so block it.
  const { data: returnRefs } = await admin
    .from('sale_returns')
    .select('id')
    .in('sale_order_id', oldIds)
    .limit(1)
  if (returnRefs && returnRefs.length > 0) {
    return {
      success: false,
      error: 'This invoice has sale returns recorded against it, so it can no longer be edited. Reverse the return first, then edit.',
      code: 'HAS_RETURNS',
    }
  }

  const serialNumber = existingLines[0].serial_number

  // Old quantity sold per item (to be returned to stock).
  const oldQtyByItem = new Map<string, number>()
  for (const l of existingLines) {
    oldQtyByItem.set(l.stock_item_id, (oldQtyByItem.get(l.stock_item_id) ?? 0) + l.quantity)
  }

  // New quantity requested per item.
  const newQtyByItem = new Map<string, number>()
  for (const l of lines) {
    newQtyByItem.set(l.stockItemId, (newQtyByItem.get(l.stockItemId) ?? 0) + l.quantity)
  }

  // Oversell check: reversing the old sale returns its qty to stock, so the
  // effective ceiling per item is current_quantity + oldQty.
  const stockIds = [...new Set([...oldQtyByItem.keys(), ...newQtyByItem.keys()])]
  const { data: lots } = await admin
    .from('inventory_lots')
    .select('id, current_quantity')
    .eq('tenant_id', tenantId)
    .in('id', stockIds)
  const currentByItem = new Map((lots ?? []).map((l) => [l.id, l.current_quantity]))

  const oversells: OversellInfo[] = []
  for (const [stockItemId, requested] of newQtyByItem) {
    const available = (currentByItem.get(stockItemId) ?? 0) + (oldQtyByItem.get(stockItemId) ?? 0)
    if (requested > available) oversells.push({ stockItemId, available, requested })
  }

  if (oversells.length > 0 && !parsed.data.allowOversell) {
    return { success: false, code: 'OVERSELL', oversells }
  }

  // ── Apply changes ──────────────────────────────────────────────
  // Insert the new lines FIRST (same invoice_id & serial) so the old rows stay
  // intact if an insert fails; only then delete the old rows.
  const createdOrders: { id: string; stockItemId: string; pkrEquivalent: number }[] = []

  for (const line of lines) {
    const effectiveRate = line.rate * (1 - (line.discountPct || 0) / 100)
    const pkrEquivalent = line.quantity * effectiveRate * (currencyCode === 'USD' ? exchangeRate : 1)

    const { data: order, error } = await admin.from('sales_orders').insert({
      tenant_id:       tenantId,
      serial_number:   serialNumber,
      customer_id:     customerId,
      stock_item_id:   line.stockItemId,
      quantity:        line.quantity,
      rate:            effectiveRate,
      currency_code:   currencyCode,
      exchange_rate:   exchangeRate,
      pkr_equivalent:  pkrEquivalent,
      date,
      payment_due_date: paymentDueDate ?? null,
      notes:           notes?.trim() ? notes.trim() : null,
      location_id:     locationId ?? null,
      invoice_id:      invoiceId,
      confirmed_at:    new Date().toISOString(),
    }).select('id').single()

    if (error || !order) {
      // Roll back any new rows we just inserted; old rows are untouched.
      if (createdOrders.length > 0) {
        await admin.from('sales_orders').delete().in('id', createdOrders.map((o) => o.id))
      }
      return { success: false, error: 'Failed to update invoice', code: 'INTERNAL_ERROR' }
    }
    createdOrders.push({ id: order.id, stockItemId: line.stockItemId, pkrEquivalent })
  }

  // Remove the old rows now that the replacements exist. If this fails (e.g. a
  // row is still FK-referenced), roll back the new inserts so nothing else is
  // touched and the invoice is left exactly as it was.
  const { error: deleteErr } = await admin
    .from('sales_orders').delete().in('id', oldIds).eq('tenant_id', tenantId)
  if (deleteErr) {
    await admin.from('sales_orders').delete().in('id', createdOrders.map((o) => o.id))
    return { success: false, error: 'Could not update this invoice — its lines are referenced by another record. No changes were made.', code: 'INTERNAL_ERROR' }
  }

  // Net inventory adjustment per item: return old qty, deduct new qty.
  for (const stockItemId of stockIds) {
    const delta = (oldQtyByItem.get(stockItemId) ?? 0) - (newQtyByItem.get(stockItemId) ?? 0)
    if (delta !== 0) {
      await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: delta })
    }
  }

  // ── Re-post the GL entry with the new totals, keeping the voucher stable ──
  const totalPKR = createdOrders.reduce((s, o) => s + o.pkrEquivalent, 0)

  const { data: oldEntry } = await admin
    .from('tajir_journal_entries')
    .select('id, voucher_number')
    .eq('source_type', 'sale_invoice')
    .eq('source_id', invoiceId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (oldEntry) {
    await admin.from('tajir_journal_entry_lines').delete().eq('journal_entry_id', oldEntry.id)
    await admin.from('tajir_journal_entries').delete().eq('id', oldEntry.id)
  }

  await postJournalEntry({
    tenantId, date, description: 'Sale Invoice',
    sourceType: 'sale_invoice', sourceId: invoiceId, prefix: 'SI',
    voucherNumber: oldEntry?.voucher_number ?? undefined,
    lines: [
      { accountSystemKey: 'accounts_receivable', debit: totalPKR, credit: 0, customerId },
      { accountSystemKey: 'sales_revenue',       debit: 0, credit: totalPKR, customerId },
      ...createdOrders.map((o) => ({ accountSystemKey: 'cogs',      debit: o.pkrEquivalent, credit: 0, stockItemId: o.stockItemId })),
      ...createdOrders.map((o) => ({ accountSystemKey: 'inventory', debit: 0, credit: o.pkrEquivalent, stockItemId: o.stockItemId })),
    ],
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'update',
    entity: 'sales_orders', entityId: invoiceId,
    before: { lineCount: existingLines.length },
    after: { customerId, date, currencyCode, totalPKR, lineCount: lines.length },
  })

  revalidatePath('/sales')

  return { success: true, data: { invoiceId } }
}
