'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

export async function deleteSaleReturnAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid ID', code: 'VALIDATION_ERROR' }
  }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can delete returns', code: 'UNAUTHORIZED' }
  }

  const admin = createAdminClient()

  const { data: ret } = await admin
    .from('sale_returns')
    .select('stock_item_id, quantity, customer_id, rate, currency_code, pkr_equivalent, date, reason')
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)
    .single()

  if (!ret) {
    return { success: false, error: 'Sale return not found', code: 'NOT_FOUND' }
  }

  /* Guard: deleting a sale return removes the returned goods from stock */
  const { data: lot } = await admin
    .from('inventory_lots')
    .select('current_quantity')
    .eq('id', ret.stock_item_id)
    .eq('tenant_id', tenantId)
    .single()
  const available = parseFloat(lot?.current_quantity ?? '0')
  const returnQty = parseFloat(ret.quantity)
  if (available - returnQty < 0) {
    return {
      success: false,
      error: `Cannot delete sale return: current stock is ${available.toLocaleString()} units. Removing this return (${returnQty.toLocaleString()} units) would result in negative stock.`,
      code: 'INSUFFICIENT_STOCK',
    }
  }

  // Reverse GL entry
  const { data: glEntry } = await admin
    .from('tajir_journal_entries')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('source_type', 'sale_return')
    .eq('source_id', parsed.data.id)
    .single()

  if (glEntry) {
    await admin.from('tajir_journal_entries').delete().eq('id', glEntry.id)
  }

  const { error } = await admin
    .from('sale_returns')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { success: false, error: 'Failed to delete sale return', code: 'INTERNAL_ERROR' }
  }

  // Reverse inventory (remove goods that were returned to stock)
  await admin.rpc('adjust_inventory_quantity', {
    p_lot_id: ret.stock_item_id,
    p_delta:  -parseFloat(ret.quantity),
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'delete',
    entity: 'sale_returns', entityId: parsed.data.id,
    before: ret,
  })

  return { success: true, data: undefined }
}
