'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  type:            z.enum(['purchase', 'sale']),
  purchaseOrderId: z.string().uuid().optional(),
  salesOrderId:    z.string().uuid().optional(),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid gatepass date'),
  vehicleNumber:   z.string().min(1, 'Vehicle number is required'),
  driverName:      z.string().min(1, 'Driver name is required'),
  remarks:         z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.type === 'purchase' && !d.purchaseOrderId) {
    ctx.addIssue({ code: 'custom', path: ['purchaseOrderId'], message: 'Select a purchase entry' })
  }
  if (d.type === 'sale' && !d.salesOrderId) {
    ctx.addIssue({ code: 'custom', path: ['salesOrderId'], message: 'Select a sale entry' })
  }
})

export type CreateGatepassInput = z.infer<typeof schema>

export async function createGatepassAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, tenantId } = await requireAuth()

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { type, purchaseOrderId, salesOrderId, date, vehicleNumber, driverName, remarks } = parsed.data
  const admin = createAdminClient()

  let entryDate: string

  if (type === 'purchase') {
    const { data: order } = await admin
      .from('purchase_orders')
      .select('date')
      .eq('id', purchaseOrderId!)
      .eq('tenant_id', tenantId)
      .single()

    if (!order) {
      return { success: false, error: 'Purchase entry not found', code: 'NOT_FOUND' }
    }
    entryDate = order.date
  } else {
    const { data: order } = await admin
      .from('sales_orders')
      .select('date')
      .eq('id', salesOrderId!)
      .eq('tenant_id', tenantId)
      .single()

    if (!order) {
      return { success: false, error: 'Sale entry not found', code: 'NOT_FOUND' }
    }
    entryDate = order.date
  }

  const { data: gatepass, error: insertError } = await admin
    .from('gatepasses')
    .insert({
      tenant_id:          tenantId,
      type,
      purchase_order_id:  type === 'purchase' ? purchaseOrderId : null,
      sales_order_id:     type === 'sale' ? salesOrderId : null,
      entry_date:         entryDate,
      date,
      vehicle_number:     vehicleNumber,
      driver_name:        driverName,
      remarks:            remarks ?? null,
    })
    .select('id')
    .single()

  if (insertError || !gatepass) {
    return { success: false, error: 'Failed to create gatepass', code: 'INTERNAL_ERROR' }
  }

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'create',
    entity: 'gatepasses',
    entityId: gatepass.id,
    after: { type, purchaseOrderId, salesOrderId, entryDate, date, vehicleNumber, driverName, remarks },
  })

  return { success: true, data: gatepass }
}
