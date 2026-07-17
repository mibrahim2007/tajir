'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { nextDocumentSerial } from '@/lib/serials/next-serial'
import { normalizeMultiplyBy, isYarnItemType } from '@/lib/yarn'
import { isPolyesterItemType, computeQtyLbs } from '@/lib/polyester'
import type { ActionResult } from '@/lib/types'

const lineSchema = z.object({
  stockItemId: z.string().uuid('Invalid stock item'),
  quantity:    z.number().positive('Quantity must be positive'),
  rate:        z.number().positive('Rate must be positive'),
  discountPct: z.number().min(0).max(100).default(0),
  // Yarn-only line fields (stored/applied only when the item's type is Yarn).
  yarnType:    z.string().optional().nullable(),
  yarnWeight:  z.coerce.number().min(0).optional().nullable(),
  multiplyBy:  z.coerce.number().positive().optional().nullable(),
  // Polyester-only line fields; QTY LBS drives the amount, stock uses quantity.
  nosCarton:       z.coerce.number().min(0).optional().nullable(),
  weightPerCarton: z.coerce.number().min(0).optional().nullable(),
})

const schema = z.object({
  customerId:     z.string().uuid('Invalid customer'),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDays:        z.number().int().min(0).max(3650).optional(),
  currencyCode:   z.enum(['PKR', 'USD']),
  exchangeRate:   z.coerce.number().positive().default(1),
  locationId:     z.string().uuid().optional(),
  poNo:           z.string().trim().max(50, 'PO no. is too long').optional().nullable(),
  dcNo:           z.string().trim().max(50, 'DC no. is too long').optional().nullable(),
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

  const { customerId, date, paymentDueDate, dueDays, currencyCode, exchangeRate, locationId, poNo, dcNo, notes, lines, allowOversell } = parsed.data
  const admin = createAdminClient()

  const { count: coaCount } = await admin
    .from('chart_of_accounts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (!coaCount) {
    return { success: false, error: 'Chart of accounts is not set up. Go to Accounts and configure it before recording sales.', code: 'COA_NOT_CONFIGURED' }
  }

  // Check stock for all lines before inserting anything
  const stockIds = [...new Set(lines.map((l) => l.stockItemId))]
  const { data: lots } = await admin.from('inventory_lots')
    .select('id, current_quantity, item_nature, item_type_id').eq('tenant_id', tenantId).in('id', stockIds)

  const lotMap = new Map((lots ?? []).map((l) => [l.id, l.current_quantity]))
  // Service items are non-stockable: no stock check, deduction, or COGS.
  const serviceIds = new Set((lots ?? []).filter((l) => l.item_nature === 'service').map((l) => l.id))
  // Yarn items expose the per-line multiplier and yarn attributes.
  const typeIds = [...new Set((lots ?? []).map((l) => l.item_type_id).filter(Boolean) as string[])]
  const { data: itemTypes } = typeIds.length
    ? await admin.from('item_types').select('id, name').eq('tenant_id', tenantId).in('id', typeIds)
    : { data: [] as { id: string; name: string }[] }
  const yarnTypeIds = new Set((itemTypes ?? []).filter((t) => isYarnItemType(t.name)).map((t) => t.id))
  const yarnIds = new Set((lots ?? []).filter((l) => l.item_type_id && yarnTypeIds.has(l.item_type_id)).map((l) => l.id))
  const polyesterTypeIds = new Set((itemTypes ?? []).filter((t) => isPolyesterItemType(t.name)).map((t) => t.id))
  const polyesterIds = new Set((lots ?? []).filter((l) => l.item_type_id && polyesterTypeIds.has(l.item_type_id)).map((l) => l.id))

  // Aggregate requested quantities per stockItemId (same item may appear multiple times)
  const requestedMap = new Map<string, number>()
  for (const line of lines) {
    requestedMap.set(line.stockItemId, (requestedMap.get(line.stockItemId) ?? 0) + line.quantity)
  }

  const oversells: OversellInfo[] = []
  for (const [stockItemId, requested] of requestedMap) {
    if (serviceIds.has(stockItemId)) continue
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
  const createdOrders: { id: string; stockItemId: string; pkrEquivalent: number; quantity: number; isService: boolean }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isService = serviceIds.has(line.stockItemId)
    // Yarn lines carry a multiplier that scales the money amount (not the qty).
    const isYarn = yarnIds.has(line.stockItemId)
    const isPolyester = polyesterIds.has(line.stockItemId)
    const multiplyBy = isYarn ? normalizeMultiplyBy(line.multiplyBy) : 1
    const effectiveRate = line.rate * (1 - (line.discountPct || 0) / 100)
    const er = currencyCode === 'USD' ? exchangeRate : 1
    // Polyester lines bill on QTY LBS (nos_carton * weight / 2.2046); stock still
    // uses `quantity`.
    const qtyLbs = isPolyester ? computeQtyLbs(line.nosCarton, line.weightPerCarton) : null
    const pkrEquivalent = isPolyester
      ? (qtyLbs ?? 0) * effectiveRate * er
      : line.quantity * effectiveRate * er * multiplyBy

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
      due_days:        dueDays ?? null,
      po_no:           poNo || null,
      dc_no:           dcNo || null,
      notes:           notes?.trim() ? notes.trim() : null,
      yarn_type:       isYarn ? (line.yarnType?.trim() || null) : null,
      yarn_weight:     isYarn ? (line.yarnWeight ?? null) : null,
      multiply_by:     multiplyBy,
      nos_carton:        isPolyester ? (line.nosCarton ?? null) : null,
      weight_per_carton: isPolyester ? (line.weightPerCarton ?? null) : null,
      qty_lbs:           isPolyester ? qtyLbs : null,
      // Service lines are not bound to a dispatch location.
      location_id:     isService ? null : (locationId ?? null),
      invoice_id:      invoiceId,
      confirmed_at:    new Date().toISOString(),
    }).select('id').single()

    if (error || !order) {
      if (createdOrders.length > 0) {
        await admin.from('sales_orders').delete().in('id', createdOrders.map((o) => o.id))
        // Restore stock only for the stockable lines we deducted.
        for (const o of createdOrders) {
          if (!o.isService) {
            await admin.rpc('adjust_inventory_quantity', { p_lot_id: o.stockItemId, p_delta: o.quantity })
          }
        }
      }
      return { success: false, error: 'Failed to create sale line', code: 'INTERNAL_ERROR' }
    }

    if (!isService) {
      await admin.rpc('adjust_inventory_quantity', { p_lot_id: line.stockItemId, p_delta: -line.quantity })
    }
    createdOrders.push({ id: order.id, stockItemId: line.stockItemId, pkrEquivalent, quantity: line.quantity, isService })
  }

  const totalPKR = createdOrders.reduce((s, o) => s + o.pkrEquivalent, 0)
  // Split by nature: stockable goods → Sales Revenue; service lines (e.g. freight
  // paid to a third party on the customer's behalf) are a pass-through recovered
  // from the customer — see the freight legs below.
  const goodsRevenue   = createdOrders.filter((o) => !o.isService).reduce((s, o) => s + o.pkrEquivalent, 0)
  const serviceRevenue = createdOrders.filter((o) =>  o.isService).reduce((s, o) => s + o.pkrEquivalent, 0)

  // Single GL entry for the whole invoice
  await postJournalEntry({
    tenantId, date, description: 'Sale Invoice', reference: serialNumber,
    sourceType: 'sale_invoice', sourceId: invoiceId, prefix: 'SI',
    lines: [
      { accountSystemKey: 'accounts_receivable', debit: totalPKR, credit: 0, customerId },
      ...(goodsRevenue   > 0 ? [{ accountSystemKey: 'sales_revenue',  debit: 0, credit: goodsRevenue,   customerId }] : []),
      // Freight pass-through: recover the service amount from the customer (the AR
      // debit above already includes it) and pay the third party in cash, routed
      // through the Freight Clearing control account. Nets to zero — no P&L impact.
      ...(serviceRevenue > 0 ? [
        { accountSystemKey: 'freight_clearing', debit: 0,              credit: serviceRevenue, customerId },
        { accountSystemKey: 'freight_clearing', debit: serviceRevenue, credit: 0 },
        { accountSystemKey: 'cash_in_hand',     debit: 0,              credit: serviceRevenue },
      ] : []),
      // COGS/inventory relief applies to stockable lines only; service lines
      // (e.g. freight) have no cost of goods.
      ...createdOrders.filter((o) => !o.isService).map((o) => ({ accountSystemKey: 'cogs',      debit: o.pkrEquivalent, credit: 0, stockItemId: o.stockItemId })),
      ...createdOrders.filter((o) => !o.isService).map((o) => ({ accountSystemKey: 'inventory', debit: 0, credit: o.pkrEquivalent, stockItemId: o.stockItemId })),
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
