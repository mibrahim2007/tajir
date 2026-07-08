'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ invoiceId: z.string().uuid() })

export async function deleteSaleInvoiceAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { invoiceId } = parsed.data
  const admin = createAdminClient()

  const { data: orders } = await admin.from('sales_orders')
    .select('id, stock_item_id, quantity')
    .eq('invoice_id', invoiceId)
    .eq('tenant_id', tenantId)

  if (!orders || orders.length === 0) return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' }

  await admin.from('sales_orders').delete().eq('invoice_id', invoiceId).eq('tenant_id', tenantId)

  const removeMap = new Map<string, number>()
  for (const o of orders) removeMap.set(o.stock_item_id, (removeMap.get(o.stock_item_id) ?? 0) + o.quantity)
  for (const [stockItemId, qty] of removeMap) {
    await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: qty })
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'delete',
    entity: 'sales_orders', entityId: invoiceId,
    before: { invoiceId, lineCount: orders.length },
  })

  return { success: true, data: undefined }
}
