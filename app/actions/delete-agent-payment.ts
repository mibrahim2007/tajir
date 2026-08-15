'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { checkPeriodOpen } from '@/lib/accounting/period-lock'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

export async function deleteAgentPaymentAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id } = parsed.data
  const admin = createAdminClient()

  const { data: payment } = await admin
    .from('agent_payments')
    .select('agent_id, amount, pkr_equivalent, date, serial_number')
    .eq('id', id).eq('tenant_id', tenantId).maybeSingle()

  if (!payment) return { success: false, error: 'Payment not found', code: 'NOT_FOUND' }

  // Stop before touching anything: the trigger would refuse to remove the
  // journal entry, and the payment row would already be gone by then.
  const locked = await checkPeriodOpen(tenantId, payment.date as string, 'This payment')
  if (locked) return locked

  // Remove the GL entry first (its lines cascade); then the payment (its tender
  // lines cascade). Keeps the payable from drifting on delete.
  await admin
    .from('tajir_journal_entries')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('source_type', 'agent_payment')
    .eq('source_id', id)

  const { error } = await admin.from('agent_payments').delete().eq('id', id).eq('tenant_id', tenantId)
  if (error) return { success: false, error: 'Failed to delete payment', code: 'INTERNAL_ERROR' }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'delete', entity: 'agent_payments', entityId: id,
    before: {
      agentId: payment.agent_id, amount: payment.amount,
      pkrEquivalent: payment.pkr_equivalent, date: payment.date, serialNumber: payment.serial_number,
    },
  })

  return { success: true, data: undefined }
}
