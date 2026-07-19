'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

// Deletes a profit allocation (owner-only) and reverses its GL by removing the
// journal entry. Allocation lines cascade. Reversing frees the period so it can
// be re-allocated after correcting shares or late entries.
export async function deleteProfitAllocationAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id } = parsed.data
  const admin = createAdminClient()

  const { data: alloc } = await admin
    .from('profit_allocations')
    .select('serial_number, period_start, period_end, net_profit, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!alloc) return { success: false, error: 'Allocation not found', code: 'NOT_FOUND' }

  // Remove the reversing entry too when the period was reopened, otherwise it
  // would be left on the ledger cancelling an allocation that no longer exists.
  await admin.from('tajir_journal_entries').delete()
    .eq('tenant_id', tenantId)
    .in('source_type', ['profit_allocation', 'profit_allocation_reversal'])
    .eq('source_id', id)

  const { error } = await admin.from('profit_allocations').delete().eq('id', id).eq('tenant_id', tenantId)
  if (error) return { success: false, error: 'Failed to delete allocation', code: 'INTERNAL_ERROR' }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'delete', entity: 'profit_allocations', entityId: id,
    before: {
      serialNumber: alloc.serial_number, periodStart: alloc.period_start,
      periodEnd: alloc.period_end, netProfit: alloc.net_profit, status: alloc.status,
    },
  })

  return { success: true, data: undefined }
}
