'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { documentDateSchema } from '@/lib/validation/document-date'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { repostJournalEntry } from '@/lib/accounting/repost-journal-entry'
import { normalizeMultiplyBy } from '@/lib/yarn'
import { usesYarnFields, usesCartons, cartonStockQty, lineQtyLbs, lineGrossAmount } from '@/lib/item-formula'
import { loadProfilesFor, profileOf } from '@/lib/inventory/item-profiles'
import { resolveLineTracking, findPositionShortfalls } from '@/lib/inventory/line-tracking'
import { loadStockPositions } from '@/lib/inventory/stock-position'
import { checkTenantRefs } from '@/lib/inventory/tenant-refs'
import { describeShortfalls } from '@/lib/inventory/shortfall-message'
import { glEditFailed } from '@/lib/accounting/gl-failure'
import {
  resolveAgentCommission,
  commissionJournalLines,
  syncAgentCommission,
} from '@/lib/agents/apply-commission'
import { commissionTypeSchema } from '@/lib/agents/commission'
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
  // Grade / lot (0072): required when the item type tracks them, and picked
  // from the stock held at the invoice's location.
  gradeId:         z.string().uuid().optional().nullable(),
  lotNo:           z.string().trim().max(60).optional().nullable(),
})

const schema = z.object({
  invoiceId:      z.string().uuid('Invalid invoice'),
  customerId:     z.string().uuid('Invalid customer'),
  date:           documentDateSchema,
  paymentDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDays:        z.number().int().min(0).max(3650).optional(),
  currencyCode:   z.enum(['PKR', 'USD']),
  exchangeRate:   z.coerce.number().positive().default(1),
  locationId:     z.string().uuid().optional(),
  poNo:           z.string().trim().max(50, 'PO no. is too long').optional().nullable(),
  dcNo:           z.string().trim().max(50, 'DC no. is too long').optional().nullable(),
  notes:          z.string().optional(),
  allowOversell:  z.boolean().optional(),
  agentId:                z.string().uuid().optional().nullable(),
  agentCommissionType:    commissionTypeSchema.optional().nullable(),
  agentCommissionRate:    z.coerce.number().min(0).optional().nullable(),
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

  const { invoiceId, customerId, date, paymentDueDate, dueDays, currencyCode, exchangeRate, locationId, poNo, dcNo, notes,
          agentId, agentCommissionType, agentCommissionRate } = parsed.data
  const admin = createAdminClient()

  // Each line follows its item type's formula (lib/item-formula.ts). Carton
  // lines derive their stock quantity from cartons × weight (per pack: packs).
  const profiles = await loadProfilesFor(admin, tenantId, parsed.data.lines.map((l) => l.stockItemId))
  const lines = parsed.data.lines.map((l) => ({
    ...l,
    quantity: cartonStockQty(profileOf(profiles, l.stockItemId).formula, l) ?? l.quantity,
  }))
  const badLine = lines.findIndex((l) => !(l.quantity > 0))
  if (badLine >= 0) return { success: false, error: `Line ${badLine + 1}: enter Nos Carton and Weight`, code: 'VALIDATION_ERROR' }

  // Existing lines for this invoice — the basis for reversing inventory & GL.
  const { data: existingLines } = await admin
    .from('sales_orders')
    .select('id, serial_number, stock_item_id, quantity, location_id, grade_id, lot_no')
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
    .select('id, current_quantity, item_nature, item_type_id')
    .eq('tenant_id', tenantId)
    .in('id', stockIds)
  const currentByItem = new Map((lots ?? []).map((l) => [l.id, l.current_quantity]))
  // Service items are non-stockable: no stock check, adjustment, or COGS.
  const serviceIds = new Set((lots ?? []).filter((l) => l.item_nature === 'service').map((l) => l.id))

  const oversells: OversellInfo[] = []
  for (const [stockItemId, requested] of newQtyByItem) {
    if (serviceIds.has(stockItemId)) continue
    const available = (currentByItem.get(stockItemId) ?? 0) + (oldQtyByItem.get(stockItemId) ?? 0)
    if (requested > available) oversells.push({ stockItemId, available, requested })
  }

  if (oversells.length > 0 && !parsed.data.allowOversell) {
    return { success: false, code: 'OVERSELL', oversells }
  }


  // Grade / lot rules per line, then a stock check per grade / lot position at
  // the dispatch location for items that track them. An owner who confirmed an
  // oversell overrides this too.
  const tracking: { gradeId: string | null; lotNo: string | null }[] = []
  for (let i = 0; i < lines.length; i++) {
    const t = resolveLineTracking(profileOf(profiles, lines[i].stockItemId), lines[i], { lineLabel: `Line ${i + 1}` })
    if (!t.ok) return { success: false, error: t.error, code: 'VALIDATION_ERROR' }
    tracking.push({ gradeId: t.gradeId, lotNo: t.lotNo })
  }
  const refError = await checkTenantRefs(admin, tenantId, { gradeIds: tracking.map((t) => t.gradeId) })
  if (refError) return { success: false, error: refError, code: 'VALIDATION_ERROR' }
  if (!(parsed.data.allowOversell)) {
    const outgoing = lines.map((l, i) => {
      const p = profileOf(profiles, l.stockItemId)
      return {
        stockItemId: l.stockItemId,
        locationId:  serviceIds.has(l.stockItemId) ? null : (locationId ?? null),
        gradeId:     tracking[i].gradeId,
        lotNo:       tracking[i].lotNo,
        quantity:    l.quantity,
        trackGrade:  p.trackGrade,
        trackLot:    p.trackLot,
      }
    })
    const positions = await loadStockPositions(admin, tenantId, { stockItemIds: stockIds, locationId: locationId ?? null })
    const shortfalls = findPositionShortfalls(positions, outgoing, (existingLines ?? []).map((l) => {
      const p = profileOf(profiles, l.stock_item_id)
      return {
        stockItemId: l.stock_item_id, locationId: l.location_id, gradeId: l.grade_id, lotNo: l.lot_no,
        quantity: l.quantity, trackGrade: p.trackGrade, trackLot: p.trackLot,
      }
    }))
    if (shortfalls.length > 0) {
      return { success: false, error: await describeShortfalls(admin, tenantId, shortfalls), code: 'INSUFFICIENT_STOCK' }
    }
  }

  // ── Apply changes ──────────────────────────────────────────────
  // Insert the new lines FIRST (same invoice_id & serial) so the old rows stay
  // intact if an insert fails; only then delete the old rows.
  const createdOrders: { id: string; stockItemId: string; pkrEquivalent: number; quantity: number; isService: boolean }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isService = serviceIds.has(line.stockItemId)
    const formula = profileOf(profiles, line.stockItemId).formula
    const isYarn = usesYarnFields(formula)
    const isCarton = usesCartons(formula)
    const multiplyBy = isYarn ? normalizeMultiplyBy(line.multiplyBy) : 1
    const effectiveRate = line.rate * (1 - (line.discountPct || 0) / 100)
    const er = currencyCode === 'USD' ? exchangeRate : 1
    const qtyLbs = lineQtyLbs(formula, line)
    const pkrEquivalent = lineGrossAmount(formula, line, effectiveRate, er)

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
      grade_id:        tracking[i].gradeId,
      lot_no:          tracking[i].lotNo,
      nos_carton:        isCarton ? (line.nosCarton ?? null) : null,
      weight_per_carton: isCarton ? (line.weightPerCarton ?? null) : null,
      qty_lbs:           qtyLbs,
      // Service lines are not bound to a dispatch location.
      location_id:     isService ? null : (locationId ?? null),
      // Stamped on every row of the invoice, like serial_number.
      agent_id:        agentId ?? null,
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
    createdOrders.push({ id: order.id, stockItemId: line.stockItemId, pkrEquivalent, quantity: line.quantity, isService })
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
  // Service items never touched stock, so skip them.
  for (const stockItemId of stockIds) {
    if (serviceIds.has(stockItemId)) continue
    const delta = (oldQtyByItem.get(stockItemId) ?? 0) - (newQtyByItem.get(stockItemId) ?? 0)
    if (delta !== 0) {
      await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: delta })
    }
  }

  // ── Re-post the GL entry with the new totals, keeping the voucher stable ──
  const totalPKR = createdOrders.reduce((s, o) => s + o.pkrEquivalent, 0)
  // Split by nature: stockable goods → Sales Revenue; service lines are a freight
  // pass-through recovered from the customer (see the freight legs below).
  const goodsRevenue   = createdOrders.filter((o) => !o.isService).reduce((s, o) => s + o.pkrEquivalent, 0)
  const serviceRevenue = createdOrders.filter((o) =>  o.isService).reduce((s, o) => s + o.pkrEquivalent, 0)

  // Re-derive the commission from the invoice as it now stands, on the goods
  // only (a freight pass-through is not the agent's trade). Because the accrual
  // is rebuilt rather than adjusted, an edit that changes the value, swaps the
  // agent, or removes them entirely all land correctly — and `syncAgentCommission`
  // below drops the stored row when nothing is owed any more.
  const goodsQuantity = createdOrders.filter((o) => !o.isService).reduce((s, o) => s + o.quantity, 0)
  const resolved = await resolveAgentCommission(admin, tenantId, {
    agentId, side: 'sale',
    baseAmount: goodsRevenue,
    baseQuantity: goodsQuantity,
    overrideType: agentCommissionType,
    overrideRate: agentCommissionRate,
  })
  if (!resolved.ok) return { success: false, error: resolved.error, code: 'NOT_FOUND' }
  const accrual = resolved.accrual

  // The helper snapshots the previous entry first, so a failed post restores
  // it instead of leaving this invoice with no ledger entry.
  const posted = await repostJournalEntry({
    tenantId, date, description: 'Sale Invoice', reference: serialNumber ?? undefined,
    sourceType: 'sale_invoice', sourceId: invoiceId, prefix: 'SI',
    lines: [
      { accountSystemKey: 'accounts_receivable', debit: totalPKR, credit: 0, customerId },
      ...(goodsRevenue   > 0 ? [{ accountSystemKey: 'sales_revenue',  debit: 0, credit: goodsRevenue,   customerId }] : []),
      // Freight pass-through: recover from the customer (in the AR debit above) and
      // pay the third party in cash via the Freight Clearing control account.
      ...(serviceRevenue > 0 ? [
        { accountSystemKey: 'freight_clearing', debit: 0,              credit: serviceRevenue, customerId },
        { accountSystemKey: 'freight_clearing', debit: serviceRevenue, credit: 0 },
        { accountSystemKey: 'cash_in_hand',     debit: 0,              credit: serviceRevenue },
      ] : []),
      // COGS/inventory relief applies to stockable lines only.
      ...createdOrders.filter((o) => !o.isService).map((o) => ({ accountSystemKey: 'cogs',      debit: o.pkrEquivalent, credit: 0, stockItemId: o.stockItemId })),
      ...createdOrders.filter((o) => !o.isService).map((o) => ({ accountSystemKey: 'inventory', debit: 0, credit: o.pkrEquivalent, stockItemId: o.stockItemId })),
      // Broker's commission — rebuilt from the edited invoice, so the payable
      // moves with it instead of keeping the amount the original sale accrued.
      ...commissionJournalLines(accrual),
    ],
  })
  if (!posted.ok) return glEditFailed(posted.message)

  // Restate (or clear) the accrual row now that the GL agrees with the edit.
  const { data: cust } = await admin
    .from('tajir_customers').select('name').eq('id', customerId).eq('tenant_id', tenantId).maybeSingle()
  await syncAgentCommission(admin, {
    tenantId, accrual, sourceType: 'sale_invoice', sourceId: invoiceId,
    documentSerial: serialNumber, partyName: cust?.name ?? null, date,
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'update',
    entity: 'sales_orders', entityId: invoiceId,
    before: { lineCount: existingLines.length },
    after: {
      customerId, date, currencyCode, totalPKR, lineCount: lines.length,
      agentId: agentId ?? null, commission: accrual?.amount ?? 0,
    },
  })

  revalidatePath('/sales')

  return { success: true, data: { invoiceId } }
}
