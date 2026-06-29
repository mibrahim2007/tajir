'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

export async function deletePurchaseReturnAction(input: unknown): Promise<ActionResult<void>> {
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
    .from('purchase_returns')
    .select('stock_item_id, quantity, supplier_id, rate, currency_code, pkr_equivalent, date, reason')
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)
    .single()

  if (!ret) {
    return { success: false, error: 'Purchase return not found', code: 'NOT_FOUND' }
  }

  // Reverse GL entry
  const { data: glEntry } = await admin
    .from('tajir_journal_entries')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('source_type', 'purchase_return')
    .eq('source_id', parsed.data.id)
    .single()

  if (glEntry) {
    await admin.from('tajir_journal_entries').delete().eq('id', glEntry.id)
  }

  const { error } = await admin
    .from('purchase_returns')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { success: false, error: 'Failed to delete purchase return', code: 'INTERNAL_ERROR' }
  }

  // Restore inventory
  await admin.rpc('adjust_inventory_quantity', {
    p_lot_id: ret.stock_item_id,
    p_delta:  parseFloat(ret.quantity),
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'delete',
    entity: 'purchase_returns', entityId: parsed.data.id,
    before: ret,
  })

  return { success: true, data: undefined }
}
