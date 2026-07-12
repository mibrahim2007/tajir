'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { nextDocumentSerial } from '@/lib/serials/next-serial'
import type { ActionResult } from '@/lib/types'

const lineSchema = z.object({
  stockItemId: z.string().uuid('Invalid stock item'),
  quantity:    z.number().positive('Quantity must be positive'),
  rate:        z.number().positive('Rate must be positive'),
  discountPct: z.number().min(0).max(100).default(0),
})

const schema = z.object({
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

export type CreateSaleInvoiceInput = z.infer<typeof schema>

type OversellInfo = { stockItemId: string; available: number; requested: number }

export async function createSaleInvoiceAction(
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
  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { customerId, date, paymentDueDate, currencyCode, exchangeRate, locationId, notes, lines, allowOversell } = parsed.data
  const admin = createAdminClient()

  const { count: coaCount } = await admin
    .from('chart_of_accounts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (!coaCount) {
    return { success: false, error: 'Chart of accounts is not set up. Go to Accounts and configure it before recording sales.', code: 'COA_NOT_CONFIGURED' }
  }

  // Check stock for all lines before inserting anything
  const stockIds = [...new Set(lines.map((l) => l.stockItemId))]
  const { data: lots } = await admin.from('inventory_lots')
    .select('id, current_quantity').eq('tenant_id', tenantId).in('id', stockIds)

  const lotMap = new Map((lots ?? []).map((l) => [l.id, l.current_quantity]))

  // Aggregate requested quantities per stockItemId (same item may appear multiple times)
  const requestedMap = new Map<string, number>()
  for (const line of lines) {
    requestedMap.set(line.stockItemId, (requestedMap.get(line.stockItemId) ?? 0) + line.quantity)
  }

  const oversells: OversellInfo[] = []
  for (const [stockItemId, requested] of requestedMap) {
    const available = lotMap.get(stockItemId) ?? 0
    if (available < requested) {
      oversells.push({ stockItemId, available, requested })
    }
  }

  if (oversells.length > 0 && !allowOversell) {
    return { success: false, code: 'OVERSELL', oversells }
  }

  if (oversells.length > 0 && allowOversell && role === 'assistant') {
    return { success: false, error: 'Only the Owner can override stock limits', code: 'UNAUTHORIZED' }
  }

  const invoiceId = crypto.randomUUID()
  // One serial for the whole invoice — shared across every line row.
  const serialNumber = await nextDocumentSerial(admin, tenantId, 'sale_invoice', date)
  const createdOrders: { id: string; stockItemId: string; pkrEquivalent: number; quantity: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
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
      if (createdOrders.length > 0) {
        await admin.from('sales_orders').delete().in('id', createdOrders.map((o) => o.id))
        for (const o of createdOrders) {
          await admin.rpc('adjust_inventory_quantity', { p_lot_id: o.stockItemId, p_delta: o.quantity })
        }
      }
      return { success: false, error: 'Failed to create sale line', code: 'INTERNAL_ERROR' }
    }

    await admin.rpc('adjust_inventory_quantity', { p_lot_id: line.stockItemId, p_delta: -line.quantity })
    createdOrders.push({ id: order.id, stockItemId: line.stockItemId, pkrEquivalent, quantity: line.quantity })
  }

  const totalPKR = createdOrders.reduce((s, o) => s + o.pkrEquivalent, 0)

  // Single GL entry for the whole invoice
  await postJournalEntry({
    tenantId, date, description: 'Sale Invoice', reference: serialNumber,
    sourceType: 'sale_invoice', sourceId: invoiceId, prefix: 'SI',
    lines: [
      { accountSystemKey: 'accounts_receivable', debit: totalPKR, credit: 0, customerId },
      { accountSystemKey: 'sales_revenue',       debit: 0, credit: totalPKR, customerId },
      ...createdOrders.map((o) => ({ accountSystemKey: 'cogs',      debit: o.pkrEquivalent, credit: 0, stockItemId: o.stockItemId })),
      ...createdOrders.map((o) => ({ accountSystemKey: 'inventory', debit: 0, credit: o.pkrEquivalent, stockItemId: o.stockItemId })),
    ],
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create',
    entity: 'sales_orders', entityId: invoiceId,
    after: { customerId, date, currencyCode, totalPKR, lineCount: lines.length },
  })

  // Invalidate the sales list server-side so the client can navigate to a fresh
  // /sales in a single load — no redundant client-side router.refresh() that
  // would re-render the heavy list a second time and wedge the "Saving…" state.
  revalidatePath('/sales')

  return { success: true, data: { invoiceId } }
}
