'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ invoiceId: z.string().uuid() })

export async function deletePurchaseInvoiceAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { invoiceId } = parsed.data
  const admin = createAdminClient()

  const { data: orders } = await admin.from('purchase_orders')
    .select('id, stock_item_id, quantity')
    .eq('invoice_id', invoiceId)
    .eq('tenant_id', tenantId)

  if (!orders || orders.length === 0) return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' }

  // Check no item would go negative
  const stockIds = [...new Set(orders.map((o) => o.stock_item_id))]
  const { data: lots } = await admin.from('inventory_lots')
    .select('id, current_quantity').eq('tenant_id', tenantId).in('id', stockIds)
  const lotMap = new Map((lots ?? []).map((l) => [l.id, parseFloat(l.current_quantity)]))

  const removeMap = new Map<string, number>()
  for (const o of orders) removeMap.set(o.stock_item_id, (removeMap.get(o.stock_item_id) ?? 0) + parseFloat(o.quantity))

  for (const [stockItemId, qty] of removeMap) {
    if ((lotMap.get(stockItemId) ?? 0) - qty < 0) {
      return { success: false, error: 'Cannot delete: removing this invoice would result in negative stock for one or more items.', code: 'INSUFFICIENT_STOCK' }
    }
  }

  await admin.from('purchase_orders').delete().eq('invoice_id', invoiceId).eq('tenant_id', tenantId)

  for (const [stockItemId, qty] of removeMap) {
    await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: -qty })
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'delete',
    entity: 'purchase_orders', entityId: invoiceId,
    before: { invoiceId, lineCount: orders.length },
  })

  return { success: true, data: undefined }
}
