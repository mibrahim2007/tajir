'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { nextDocumentSerial } from '@/lib/serials/next-serial'
import { normalizeMultiplyBy, isYarnItemType } from '@/lib/yarn'
import { isPolyesterItemType, computeQtyLbs } from '@/lib/polyester'
import { glCreateFailed } from '@/lib/accounting/gl-failure'
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
  // Polyester-only line fields (stored/applied only when the item's type is a
  // Polyester type). QTY LBS drives the amount; stock still uses `quantity`.
  nosCarton:       z.coerce.number().min(0).optional().nullable(),
  weightPerCarton: z.coerce.number().min(0).optional().nullable(),
})

const schema = z.object({
  supplierId:   z.string().uuid('Invalid supplier'),
  // The supplier's own bill number. Optional; stored on every line of the invoice.
  supplierInvoiceNo: z.string().trim().max(50, 'Supplier invoice no. is too long').optional().nullable(),
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

export type CreatePurchaseInvoiceInput = z.infer<typeof schema>

export async function createPurchaseInvoiceAction(
  input: unknown
): Promise<ActionResult<{ invoiceId: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, tenantId } = await requireAuth()
  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { supplierId, supplierInvoiceNo, date, currencyCode, exchangeRate, advancePaid, locationId, lines } = parsed.data
  const admin = createAdminClient()

  const { count: coaCount } = await admin
    .from('chart_of_accounts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (!coaCount) {
    return { success: false, error: 'Chart of accounts is not set up. Go to Accounts and configure it before recording purchases.', code: 'COA_NOT_CONFIGURED' }
  }

  // Resolve which line items are yarn (their type is named "Yarn") so the
  // per-line multiplier and yarn attributes apply only to those lines.
  const stockIds = [...new Set(lines.map((l) => l.stockItemId))]
  const { data: lots } = await admin.from('inventory_lots')
    .select('id, item_type_id').eq('tenant_id', tenantId).in('id', stockIds)
  const typeIds = [...new Set((lots ?? []).map((l) => l.item_type_id).filter(Boolean) as string[])]
  const { data: itemTypes } = typeIds.length
    ? await admin.from('item_types').select('id, name').eq('tenant_id', tenantId).in('id', typeIds)
    : { data: [] as { id: string; name: string }[] }
  const yarnTypeIds = new Set((itemTypes ?? []).filter((t) => isYarnItemType(t.name)).map((t) => t.id))
  const yarnIds = new Set((lots ?? []).filter((l) => l.item_type_id && yarnTypeIds.has(l.item_type_id)).map((l) => l.id))
  const polyesterTypeIds = new Set((itemTypes ?? []).filter((t) => isPolyesterItemType(t.name)).map((t) => t.id))
  const polyesterIds = new Set((lots ?? []).filter((l) => l.item_type_id && polyesterTypeIds.has(l.item_type_id)).map((l) => l.id))

  const invoiceId = crypto.randomUUID()
  // One serial for the whole invoice — shared across every line row.
  const serialNumber = await nextDocumentSerial(admin, tenantId, 'purchase_order', date)
  const createdOrders: { id: string; stockItemId: string; pkrEquivalent: number; quantity: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isYarn = yarnIds.has(line.stockItemId)
    const isPolyester = polyesterIds.has(line.stockItemId)
    const multiplyBy = isYarn ? normalizeMultiplyBy(line.multiplyBy) : 1
    const effectiveRate = line.rate * (1 - (line.discountPct || 0) / 100)
    const er = currencyCode === 'USD' ? exchangeRate : 1
    // Polyester lines bill on QTY LBS (nos_carton * weight / 2.2046); all other
    // lines bill on quantity (with the yarn multiplier).
    const qtyLbs = isPolyester ? computeQtyLbs(line.nosCarton, line.weightPerCarton) : null
    const pkrEquivalent = isPolyester
      ? (qtyLbs ?? 0) * effectiveRate * er
      : line.quantity * effectiveRate * er * multiplyBy

    const { data: order, error } = await admin.from('purchase_orders').insert({
      tenant_id:      tenantId,
      serial_number:  serialNumber,
      supplier_invoice_no: supplierInvoiceNo || null,
      supplier_id:    supplierId,
      stock_item_id:  line.stockItemId,
      quantity:       line.quantity,
      rate:           effectiveRate,
      currency_code:  currencyCode,
      exchange_rate:  exchangeRate,
      pkr_equivalent: pkrEquivalent,
      advance_paid:   i === 0 ? advancePaid : 0,
      date,
      yarn_type:      isYarn ? (line.yarnType?.trim() || null) : null,
      yarn_weight:    isYarn ? (line.yarnWeight ?? null) : null,
      multiply_by:    multiplyBy,
      nos_carton:        isPolyester ? (line.nosCarton ?? null) : null,
      weight_per_carton: isPolyester ? (line.weightPerCarton ?? null) : null,
      qty_lbs:           isPolyester ? qtyLbs : null,
      location_id:    locationId,
      invoice_id:     invoiceId,
      confirmed_at:   new Date().toISOString(),
    }).select('id').single()

    if (error || !order) {
      // Rollback already-inserted lines
      if (createdOrders.length > 0) {
        await admin.from('purchase_orders').delete().in('id', createdOrders.map((o) => o.id))
        for (const o of createdOrders) {
          await admin.rpc('adjust_inventory_quantity', { p_lot_id: o.stockItemId, p_delta: -o.quantity })
        }
      }
      return { success: false, error: 'Failed to create purchase line', code: 'INTERNAL_ERROR' }
    }

    await admin.rpc('adjust_inventory_quantity', { p_lot_id: line.stockItemId, p_delta: line.quantity })
    createdOrders.push({ id: order.id, stockItemId: line.stockItemId, pkrEquivalent, quantity: line.quantity })
  }

  const totalPKR = createdOrders.reduce((s, o) => s + o.pkrEquivalent, 0)

  // Single GL entry for the whole invoice
  const posted = await postJournalEntry({
    tenantId, date, description: 'Purchase Invoice', reference: serialNumber,
    sourceType: 'purchase_invoice', sourceId: invoiceId, prefix: 'PI',
    lines: [
      ...createdOrders.map((o) => ({ accountSystemKey: 'inventory', debit: o.pkrEquivalent, credit: 0, stockItemId: o.stockItemId })),
      { accountSystemKey: 'accounts_payable', debit: 0, credit: totalPKR, supplierId },
    ],
  })
  // Same compensation the mid-loop failure path uses: drop every line we
  // inserted and undo the stock each one added.
  if (!posted.ok) {
    if (createdOrders.length > 0) {
      await admin.from('purchase_orders').delete().in('id', createdOrders.map((o) => o.id))
      for (const o of createdOrders) {
        await admin.rpc('adjust_inventory_quantity', { p_lot_id: o.stockItemId, p_delta: -o.quantity })
      }
    }
    return glCreateFailed(posted.message)
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create',
    entity: 'purchase_orders', entityId: invoiceId,
    after: { supplierId, supplierInvoiceNo, date, currencyCode, totalPKR, lineCount: lines.length },
  })

  return { success: true, data: { invoiceId } }
}
