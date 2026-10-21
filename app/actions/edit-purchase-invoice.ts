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
import { resolveLineTracking } from '@/lib/inventory/line-tracking'
import { checkTenantRefs } from '@/lib/inventory/tenant-refs'
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
  // Grade / lot (0072): required when the item type tracks them; a tracked lot
  // left blank is numbered from the invoice serial.
  gradeId:         z.string().uuid().optional().nullable(),
  lotNo:           z.string().trim().max(60).optional().nullable(),
  // Godown for this line; blank means the invoice's Receive At location.
  locationId:      z.string().uuid().optional().nullable(),
})

const schema = z.object({
  invoiceId:    z.string().uuid('Invalid invoice'),
  supplierId:   z.string().uuid('Invalid supplier'),
  supplierInvoiceNo: z.string().trim().max(50, 'Supplier invoice no. is too long').optional().nullable(),
  date:         documentDateSchema,
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.coerce.number().positive().default(1),
  advancePaid:  z.coerce.number().min(0).default(0),
  locationId:   z.string().uuid('Location is required'),
  notes:        z.string().optional(),
  agentId:              z.string().uuid().optional().nullable(),
  agentCommissionType:  commissionTypeSchema.optional().nullable(),
  agentCommissionRate:  z.coerce.number().min(0).optional().nullable(),
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

  const { invoiceId, supplierId, supplierInvoiceNo, date, currencyCode, exchangeRate, advancePaid, locationId, notes,
          agentId, agentCommissionType, agentCommissionRate } = parsed.data
  const admin = createAdminClient()
  const er = currencyCode === 'USD' ? exchangeRate : 1

  // Each line follows its item type's formula (lib/item-formula.ts). Carton
  // lines derive their stock quantity from cartons × weight (per pack: packs).
  const profiles = await loadProfilesFor(admin, tenantId, parsed.data.lines.map((l) => l.stockItemId))
  const lines = parsed.data.lines.map((l) => ({
    ...l,
    quantity: cartonStockQty(profileOf(profiles, l.stockItemId).formula, l) ?? l.quantity,
  }))
  const badLine = lines.findIndex((l) => !(l.quantity > 0))
  if (badLine >= 0) return { success: false, error: `Line ${badLine + 1}: enter Nos Carton and Weight`, code: 'VALIDATION_ERROR' }

  // Grade / lot rules per line (item type flags). Lot numbers are generated
  // after the serial is known; this pass only catches missing grades.
  for (let i = 0; i < lines.length; i++) {
    const t = resolveLineTracking(profileOf(profiles, lines[i].stockItemId), lines[i], {
      lineLabel: `Line ${i + 1}`, generateLot: { serialNumber: null, lineIndex: i },
    })
    if (!t.ok) return { success: false, error: t.error, code: 'VALIDATION_ERROR' }
  }
  const refError = await checkTenantRefs(admin, tenantId, {
    gradeIds:    lines.map((l) => l.gradeId),
    locationIds: [locationId, ...lines.map((l) => l.locationId)],
  })
  if (refError) return { success: false, error: refError, code: 'VALIDATION_ERROR' }

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

  // Insert the new lines FIRST (same invoice_id & serial) so the old rows stay
  // intact if an insert fails; only then delete the old rows.
  const createdOrders: { id: string; stockItemId: string; pkrEquivalent: number; quantity: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const formula = profileOf(profiles, line.stockItemId).formula
    const tracking = resolveLineTracking(profileOf(profiles, line.stockItemId), line, {
      lineLabel: `Line ${i + 1}`, generateLot: { serialNumber, lineIndex: i },
    })
    const gradeId = tracking.ok ? tracking.gradeId : null
    const lotNo = tracking.ok ? tracking.lotNo : null
    const yarn = usesYarnFields(formula)
    const carton = usesCartons(formula)
    const multiplyBy = yarn ? normalizeMultiplyBy(line.multiplyBy) : 1
    const effectiveRate = line.rate * (1 - (line.discountPct || 0) / 100)
    const qtyLbs = lineQtyLbs(formula, line)
    const pkrEquivalent = lineGrossAmount(formula, line, effectiveRate, er)

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
      yarn_type:      yarn ? (line.yarnType?.trim() || null) : null,
      yarn_weight:    yarn ? (line.yarnWeight ?? null) : null,
      multiply_by:    multiplyBy,
      nos_carton:        carton ? (line.nosCarton ?? null) : null,
      weight_per_carton: carton ? (line.weightPerCarton ?? null) : null,
      qty_lbs:           qtyLbs,
      location_id:    line.locationId || locationId,
      grade_id:       gradeId,
      lot_no:         lotNo,
      // Stamped on every row of the invoice, like serial_number.
      agent_id:       agentId ?? null,
      invoice_id:     invoiceId,
      confirmed_at:   new Date().toISOString(),
    }).select('id').single()

    if (error || !order) {
      if (createdOrders.length > 0) await admin.from('purchase_orders').delete().in('id', createdOrders.map((o) => o.id))
      return { success: false, error: 'Failed to update invoice', code: 'INTERNAL_ERROR' }
    }
    createdOrders.push({ id: order.id, stockItemId: line.stockItemId, pkrEquivalent, quantity: line.quantity })
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
  const totalQty = createdOrders.reduce((s, o) => s + o.quantity, 0)

  // Re-derive the commission from the invoice as it now stands. Because the
  // accrual is rebuilt rather than adjusted, an edit that changes the value,
  // swaps the agent, or removes them entirely all land correctly — and
  // `syncAgentCommission` drops the stored row when nothing is owed any more.
  const resolved = await resolveAgentCommission(admin, tenantId, {
    agentId, side: 'purchase',
    baseAmount: totalPKR,
    baseQuantity: totalQty,
    overrideType: agentCommissionType,
    overrideRate: agentCommissionRate,
  })
  if (!resolved.ok) return { success: false, error: resolved.error, code: 'NOT_FOUND' }
  const accrual = resolved.accrual

  // The helper snapshots the previous entry first, so a failed post restores
  // it instead of leaving this invoice with no ledger entry.
  const posted = await repostJournalEntry({
    tenantId, date, description: 'Purchase Invoice', reference: serialNumber ?? undefined,
    sourceType: 'purchase_invoice', sourceId: invoiceId, prefix: 'PI',
    lines: [
      ...createdOrders.map((o) => ({ accountSystemKey: 'inventory', debit: o.pkrEquivalent, credit: 0, stockItemId: o.stockItemId })),
      { accountSystemKey: 'accounts_payable', debit: 0, credit: totalPKR, supplierId },
      // Broker's commission — expensed, so the inventory debit above stays at
      // the supplier's invoice value.
      ...commissionJournalLines(accrual),
    ],
  })
  if (!posted.ok) return glEditFailed(posted.message)

  // Restate (or clear) the accrual row now that the GL agrees with the edit.
  const { data: supp } = await admin
    .from('suppliers').select('name').eq('id', supplierId).eq('tenant_id', tenantId).maybeSingle()
  await syncAgentCommission(admin, {
    tenantId, accrual, sourceType: 'purchase_invoice', sourceId: invoiceId,
    documentSerial: serialNumber, partyName: supp?.name ?? null, date,
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'update',
    entity: 'purchase_orders', entityId: invoiceId,
    before: { lineCount: existingLines.length },
    after: {
      supplierId, supplierInvoiceNo, date, currencyCode, totalPKR, lineCount: lines.length, notes,
      agentId: agentId ?? null, commission: accrual?.amount ?? 0,
    },
  })

  revalidatePath('/purchases')
  return { success: true, data: { invoiceId } }
}
