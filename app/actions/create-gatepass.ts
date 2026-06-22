'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const lineSchema = z.object({
  orderId:  z.string().uuid('Invalid order'),
  quantity: z.coerce.number().positive('Quantity must be positive'),
})

const schema = z.object({
  type:          z.enum(['purchase', 'sale']),
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid gatepass date'),
  vehicleNumber: z.string().optional(),
  driverName:    z.string().optional(),
  remarks:       z.string().optional(),
  lines:         z.array(lineSchema).min(1, 'Add at least one item'),
})

export type CreateGatepassInput = z.infer<typeof schema>

export async function createGatepassAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, tenantId } = await requireAuth()
  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { type, date, vehicleNumber, driverName, remarks, lines } = parsed.data
  const admin = createAdminClient()

  const orderIds = lines.map(l => l.orderId)

  /* Fetch orders and validate balance — all in two batched queries */
  const orderQtyMap      = new Map<string, number>()
  const orderStockItemMap = new Map<string, string>()
  const receivedQtyMap   = new Map<string, number>()

  if (type === 'purchase') {
    const [{ data: orders }, { data: received }] = await Promise.all([
      admin.from('purchase_orders').select('id, quantity, stock_item_id')
        .in('id', orderIds).eq('tenant_id', tenantId),
      admin.from('gatepass_items').select('purchase_order_id, quantity')
        .in('purchase_order_id', orderIds),
    ])
    for (const o of orders ?? []) {
      orderQtyMap.set(o.id, Number(o.quantity))
      orderStockItemMap.set(o.id, o.stock_item_id)
    }
    for (const r of received ?? []) {
      if (r.purchase_order_id)
        receivedQtyMap.set(r.purchase_order_id, (receivedQtyMap.get(r.purchase_order_id) ?? 0) + Number(r.quantity ?? 0))
    }
  } else {
    const [{ data: orders }, { data: dispatched }] = await Promise.all([
      admin.from('sales_orders').select('id, quantity, stock_item_id')
        .in('id', orderIds).eq('tenant_id', tenantId),
      admin.from('gatepass_items').select('sales_order_id, quantity')
        .in('sales_order_id', orderIds),
    ])
    for (const o of orders ?? []) {
      orderQtyMap.set(o.id, Number(o.quantity))
      orderStockItemMap.set(o.id, o.stock_item_id)
    }
    for (const r of dispatched ?? []) {
      if (r.sales_order_id)
        receivedQtyMap.set(r.sales_order_id, (receivedQtyMap.get(r.sales_order_id) ?? 0) + Number(r.quantity ?? 0))
    }
  }

  /* Aggregate quantities by orderId (in case same order appears on multiple lines) */
  const qtyByOrder = new Map<string, number>()
  for (const line of lines)
    qtyByOrder.set(line.orderId, (qtyByOrder.get(line.orderId) ?? 0) + line.quantity)

  /* Validate each order's balance */
  for (const [orderId, newQty] of qtyByOrder) {
    const orderQty  = orderQtyMap.get(orderId)
    if (!orderQty) return { success: false, error: 'One or more orders not found', code: 'VALIDATION_ERROR' }
    const already   = receivedQtyMap.get(orderId) ?? 0
    const balance   = orderQty - already
    if (newQty > balance) {
      return {
        success: false,
        error:   `Quantity ${newQty} exceeds available balance of ${balance} for one of the selected orders`,
        code:    'VALIDATION_ERROR',
      }
    }
  }

  /* Auto-generate next GP number */
  const { count: gpCount } = await admin
    .from('gatepasses').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  const gateppassNumber = `GP-${String((gpCount ?? 0) + 1).padStart(4, '0')}`

  /* Insert master */
  const { data: gatepass, error: masterErr } = await admin
    .from('gatepasses')
    .insert({
      tenant_id:       tenantId,
      gatepass_number: gateppassNumber,
      type,
      date,
      vehicle_number:  vehicleNumber || null,
      driver_name:     driverName    || null,
      remarks:         remarks       ?? null,
    })
    .select('id')
    .single()

  if (masterErr || !gatepass) return { success: false, error: 'Failed to create gatepass', code: 'INTERNAL_ERROR' }

  /* Insert detail items */
  const itemRows = lines.map(l => ({
    gatepass_id:       gatepass.id,
    purchase_order_id: type === 'purchase' ? l.orderId : null,
    sales_order_id:    type === 'sale'     ? l.orderId : null,
    stock_item_id:     orderStockItemMap.get(l.orderId) ?? null,
    quantity:          l.quantity,
  }))

  const { error: itemsErr } = await admin.from('gatepass_items').insert(itemRows)
  if (itemsErr) {
    await admin.from('gatepasses').delete().eq('id', gatepass.id)
    return { success: false, error: 'Failed to save gatepass items', code: 'INTERNAL_ERROR' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create', entity: 'gatepasses', entityId: gatepass.id,
    after: { gateppassNumber, type, date, vehicleNumber, driverName, itemCount: lines.length },
  })

  return { success: true, data: gatepass }
}
