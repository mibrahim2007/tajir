'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { reconcileLoanStatuses } from '@/lib/loans/reconcile'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

// Deletes a loan repayment (owner-only), removes its GL journal entry, and
// reconciles loan statuses (a settled loan re-opens if its repayment is removed).
export async function deleteLoanRepaymentAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id } = parsed.data
  const admin = createAdminClient()

  const { data: repayment } = await admin
    .from('loan_repayments')
    .select('employee_id, loan_id, amount, pkr_equivalent, date')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!repayment) return { success: false, error: 'Repayment not found', code: 'NOT_FOUND' }

  // Remove the GL entry first (lines cascade), then the repayment (tender lines cascade).
  await admin.from('tajir_journal_entries').delete()
    .eq('tenant_id', tenantId).eq('source_type', 'loan_repayment').eq('source_id', id)

  const { error } = await admin.from('loan_repayments').delete().eq('id', id).eq('tenant_id', tenantId)
  if (error) return { success: false, error: 'Failed to delete repayment', code: 'INTERNAL_ERROR' }

  await reconcileLoanStatuses(admin, tenantId, repayment.employee_id)

  await createAuditEntry({
    tenantId, userId: user.id, action: 'delete', entity: 'loan_repayments', entityId: id,
    before: { employeeId: repayment.employee_id, loanId: repayment.loan_id, amount: repayment.amount, pkrEquivalent: repayment.pkr_equivalent, date: repayment.date },
  })

  return { success: true, data: undefined }
}
