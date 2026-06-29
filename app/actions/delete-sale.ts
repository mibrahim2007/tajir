'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

export async function deleteSaleAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id } = parsed.data

  const admin = createAdminClient()

  const { data: sale } = await admin
    .from('sales_orders')
    .select('customer_id, stock_item_id, quantity, rate, pkr_equivalent, date')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!sale) return { success: false, error: 'Sale not found', code: 'NOT_FOUND' }

  const { error } = await admin
    .from('sales_orders')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to delete sale', code: 'INTERNAL_ERROR' }

  // Restore inventory quantity
  await admin.rpc('adjust_inventory_quantity', { p_lot_id: sale.stock_item_id, p_delta: parseFloat(sale.quantity) })

  await createAuditEntry({ tenantId, userId: user.id, action: 'delete', entity: 'sales_orders', entityId: id, before: { customerId: sale.customer_id, stockItemId: sale.stock_item_id, quantity: sale.quantity, rate: sale.rate, pkrEquivalent: sale.pkr_equivalent, date: sale.date } })

  return { success: true, data: undefined }
}
