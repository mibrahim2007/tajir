'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { allocateEmployeeLoans, type LoanInput, type RepaymentInput } from '@/lib/loans/allocation'
import { reconcileLoanStatuses } from '@/lib/loans/reconcile'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

// Voids a loan (owner-only): reverses its disbursement GL by removing the
// journal entry and marks the loan `void` (kept for audit; excluded from the
// ledger). Blocked when repayments are already allocated to the loan — delete
// those first so the ledger can't drift.
export async function voidEmployeeLoanAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id } = parsed.data
  const admin = createAdminClient()

  const { data: loan } = await admin
    .from('employee_loans')
    .select('employee_id, principal, pkr_equivalent, currency_code, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!loan) return { success: false, error: 'Loan not found', code: 'NOT_FOUND' }
  if (loan.status === 'void') return { success: false, error: 'Loan is already void', code: 'ALREADY_VOID' }

  // Determine whether any repayment is allocated to this loan (targeted or via FIFO).
  const today = new Date().toISOString().split('T')[0]
  const [{ data: activeLoans }, { data: repayments }] = await Promise.all([
    admin.from('employee_loans').select('id, disbursement_date, pkr_equivalent')
      .eq('employee_id', loan.employee_id).eq('tenant_id', tenantId).neq('status', 'void'),
    admin.from('loan_repayments').select('id, date, pkr_equivalent, loan_id')
      .eq('employee_id', loan.employee_id).eq('tenant_id', tenantId),
  ])

  const loanInputs: LoanInput[] = (activeLoans ?? []).map((l) => ({
    id: l.id, disbursementDate: l.disbursement_date, principalPkr: l.pkr_equivalent, installments: [],
  }))
  const repaymentInputs: RepaymentInput[] = (repayments ?? []).map((r) => ({
    id: r.id, date: r.date, pkr: r.pkr_equivalent, loanId: r.loan_id ?? null,
  }))
  const { loans: allocated } = allocateEmployeeLoans(loanInputs, repaymentInputs, today)
  const thisLoan = allocated.find((l) => l.loanId === id)
  if (thisLoan && thisLoan.paidPkr > 0.01) {
    return { success: false, error: 'This loan has repayments allocated to it. Delete the repayments first, then void.', code: 'HAS_REPAYMENTS' }
  }

  // Reverse the disbursement GL (lines cascade) and mark the loan void.
  await admin.from('tajir_journal_entries').delete()
    .eq('tenant_id', tenantId).eq('source_type', 'employee_loan').eq('source_id', id)

  const { error } = await admin.from('employee_loans').update({ status: 'void' }).eq('id', id).eq('tenant_id', tenantId)
  if (error) return { success: false, error: 'Failed to void loan', code: 'INTERNAL_ERROR' }

  await reconcileLoanStatuses(admin, tenantId, loan.employee_id)

  await createAuditEntry({
    tenantId, userId: user.id, action: 'update', entity: 'employee_loans', entityId: id,
    before: { status: loan.status }, after: { status: 'void', principal: loan.principal, pkrEquivalent: loan.pkr_equivalent },
  })

  return { success: true, data: undefined }
}
