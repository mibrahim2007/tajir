'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { isPolyesterItemType, computeQtyLbs } from '@/lib/polyester'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  id:           z.string().uuid(),
  supplierId:   z.string().uuid(),
  stockItemId:  z.string().uuid(),
  quantity:     z.coerce.number().positive(),
  rate:         z.coerce.number().positive(),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.coerce.number().positive().default(1),
  advancePaid:  z.coerce.number().min(0).default(0),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  locationId:   z.string().uuid().optional().or(z.literal('')),
  nosCarton:       z.coerce.number().min(0).optional().nullable(),
  weightPerCarton: z.coerce.number().min(0).optional().nullable(),
})

export async function editPurchaseAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, supplierId, stockItemId, quantity, rate, currencyCode, exchangeRate, advancePaid, date, locationId, nosCarton, weightPerCarton } = parsed.data
  const er = currencyCode === 'USD' ? exchangeRate : 1

  const admin = createAdminClient()

  // Determine whether the edited item is a Polyester type — those bill on QTY LBS.
  const { data: lotRow } = await admin
    .from('inventory_lots').select('item_type_id').eq('id', stockItemId).eq('tenant_id', tenantId).single()
  let isPolyester = false
  if (lotRow?.item_type_id) {
    const { data: typeRow } = await admin
      .from('item_types').select('name').eq('id', lotRow.item_type_id).eq('tenant_id', tenantId).single()
    isPolyester = isPolyesterItemType(typeRow?.name)
  }
  const qtyLbs = isPolyester ? computeQtyLbs(nosCarton, weightPerCarton) : null
  const pkrEquivalent = isPolyester ? (qtyLbs ?? 0) * rate * er : quantity * rate * er

  const { data: existing } = await admin
    .from('purchase_orders')
    .select('quantity, rate, pkr_equivalent, date, stock_item_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!existing) return { success: false, error: 'Purchase not found', code: 'NOT_FOUND' }

  const oldQty = existing.quantity
  const qtyDelta = quantity - oldQty

  // Guard: reducing purchase qty removes stock — block if it would go negative
  if (qtyDelta < 0) {
    const { data: lot } = await admin
      .from('inventory_lots')
      .select('current_quantity')
      .eq('id', stockItemId)
      .eq('tenant_id', tenantId)
      .single()
    const available = lot?.current_quantity  ?? 0
    if (available + qtyDelta < 0) {
      return {
        success: false,
        error: `Cannot reduce purchase quantity: current stock is ${available.toLocaleString()} units. Reducing by ${Math.abs(qtyDelta).toLocaleString()} would result in negative stock.`,
        code: 'INSUFFICIENT_STOCK',
      }
    }
  }

  const { error } = await admin
    .from('purchase_orders')
    .update({
      supplier_id: supplierId,
      stock_item_id: stockItemId,
      quantity: quantity,
      rate: rate,
      currency_code: currencyCode,
      exchange_rate: exchangeRate,
      pkr_equivalent: pkrEquivalent,
      advance_paid: advancePaid,
      date,
      location_id: locationId || null,
      nos_carton:        isPolyester ? (nosCarton ?? null) : null,
      weight_per_carton: isPolyester ? (weightPerCarton ?? null) : null,
      qty_lbs:           isPolyester ? qtyLbs : null,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update purchase', code: 'INTERNAL_ERROR' }

  if (qtyDelta !== 0) {
    await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: qtyDelta })
  }

  await createAuditEntry({ tenantId, userId: user.id, action: 'update', entity: 'purchase_orders', entityId: id, before: { quantity: existing.quantity, rate: existing.rate, pkrEquivalent: existing.pkr_equivalent, date: existing.date }, after: { quantity, rate, pkrEquivalent, date } })

  return { success: true, data: undefined }
}
