'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

export async function deletePurchaseAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id } = parsed.data

  const admin = createAdminClient()

  const { data: purchase } = await admin
    .from('purchase_orders')
    .select('supplier_id, stock_item_id, quantity, rate, pkr_equivalent, date')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!purchase) return { success: false, error: 'Purchase not found', code: 'NOT_FOUND' }

  // Guard: deleting a purchase removes all its qty from stock
  const { data: lot } = await admin
    .from('inventory_lots')
    .select('current_quantity')
    .eq('id', purchase.stock_item_id)
    .eq('tenant_id', tenantId)
    .single()
  const available = lot?.current_quantity  ?? 0
  const purchaseQty = purchase.quantity
  if (available - purchaseQty < 0) {
    return {
      success: false,
      error: `Cannot delete purchase: current stock is ${available.toLocaleString()} units. Removing this purchase (${purchaseQty.toLocaleString()} units) would result in negative stock.`,
      code: 'INSUFFICIENT_STOCK',
    }
  }

  const { error } = await admin
    .from('purchase_orders')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to delete purchase', code: 'INTERNAL_ERROR' }

  // Reverse the inventory increment
  await admin.rpc('adjust_inventory_quantity', { p_lot_id: purchase.stock_item_id, p_delta: -purchase.quantity })

  await createAuditEntry({ tenantId, userId: user.id, action: 'delete', entity: 'purchase_orders', entityId: id, before: { supplierId: purchase.supplier_id, stockItemId: purchase.stock_item_id, quantity: purchase.quantity, rate: purchase.rate, pkrEquivalent: purchase.pkr_equivalent, date: purchase.date } })

  return { success: true, data: undefined }
}
