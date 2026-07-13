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

  // Service items are non-stockable, so their sale never deducted stock — skip
  // restoring it (otherwise their current_quantity would drift above 0).
  const stockIds = [...new Set(orders.map((o) => o.stock_item_id))]
  const { data: lots } = await admin.from('inventory_lots')
    .select('id, item_nature').eq('tenant_id', tenantId).in('id', stockIds)
  const serviceIds = new Set((lots ?? []).filter((l) => l.item_nature === 'service').map((l) => l.id))

  await admin.from('sales_orders').delete().eq('invoice_id', invoiceId).eq('tenant_id', tenantId)

  const removeMap = new Map<string, number>()
  for (const o of orders) removeMap.set(o.stock_item_id, (removeMap.get(o.stock_item_id) ?? 0) + o.quantity)
  for (const [stockItemId, qty] of removeMap) {
    if (serviceIds.has(stockItemId)) continue
    await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: qty })
  }

  // Remove the invoice's GL entry (lines + header) so AR/revenue aren't left
  // overstated. Mirrors the reversal in editSaleInvoiceAction.
  const { data: entry } = await admin
    .from('tajir_journal_entries')
    .select('id')
    .eq('source_type', 'sale_invoice')
    .eq('source_id', invoiceId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (entry) {
    await admin.from('tajir_journal_entry_lines').delete().eq('journal_entry_id', entry.id)
    await admin.from('tajir_journal_entries').delete().eq('id', entry.id)
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'delete',
    entity: 'sales_orders', entityId: invoiceId,
    before: { invoiceId, lineCount: orders.length },
  })

  return { success: true, data: undefined }
}
