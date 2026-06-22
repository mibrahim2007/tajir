'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const lineSchema = z.object({
  orderId: z.string().uuid('Invalid order'),
})

const schema = z.object({
  gateppassNumber: z.string().min(1, 'Gatepass number is required'),
  type:            z.enum(['purchase', 'sale']),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid gatepass date'),
  vehicleNumber:   z.string().optional(),
  driverName:      z.string().optional(),
  remarks:         z.string().optional(),
  lines:           z.array(lineSchema).min(1, 'Add at least one entry'),
})

export type CreateGatepassInput = z.infer<typeof schema>

export async function createGatepassAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, tenantId } = await requireAuth()
  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { gateppassNumber, type, date, vehicleNumber, driverName, remarks, lines } = parsed.data
  const admin = createAdminClient()
  const orderIds = lines.map(l => l.orderId)

  /* Look up entry dates from the linked orders */
  const entryDateMap: Record<string, string> = {}
  if (type === 'purchase') {
    const { data: orders } = await admin
      .from('purchase_orders').select('id, date')
      .in('id', orderIds).eq('tenant_id', tenantId)
    for (const o of orders ?? []) entryDateMap[o.id] = o.date
  } else {
    const { data: orders } = await admin
      .from('sales_orders').select('id, date')
      .in('id', orderIds).eq('tenant_id', tenantId)
    for (const o of orders ?? []) entryDateMap[o.id] = o.date
  }

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
    entry_date:        entryDateMap[l.orderId] ?? null,
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
