import type { SupabaseClient } from '@supabase/supabase-js'
import { allocateEmployeeLoans, type LoanInput, type RepaymentInput } from '@/lib/loans/allocation'

// Recomputes per-loan outstanding for one employee (via FIFO allocation) and
// flips loan status: active → closed when fully repaid, closed → active when a
// repayment is later deleted/reduced. `void` loans are never touched. Call this
// after any repayment create/delete or loan void. Idempotent.
export async function reconcileLoanStatuses(
  admin: SupabaseClient,
  tenantId: string,
  employeeId: string,
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawLoans }, { data: rawRepayments }] = await Promise.all([
    admin.from('employee_loans')
      .select('id, disbursement_date, pkr_equivalent, status')
      .eq('employee_id', employeeId).eq('tenant_id', tenantId).neq('status', 'void'),
    admin.from('loan_repayments')
      .select('id, date, pkr_equivalent, loan_id')
      .eq('employee_id', employeeId).eq('tenant_id', tenantId),
  ])

  const loans = rawLoans ?? []
  if (loans.length === 0) return

  const loanInputs: LoanInput[] = loans.map((l) => ({
    id: l.id,
    disbursementDate: l.disbursement_date,
    principalPkr: l.pkr_equivalent,
    installments: [], // outstanding does not depend on the schedule
  }))
  const repaymentInputs: RepaymentInput[] = (rawRepayments ?? []).map((r) => ({
    id: r.id, date: r.date, pkr: r.pkr_equivalent, loanId: r.loan_id ?? null,
  }))

  const { loans: allocated } = allocateEmployeeLoans(loanInputs, repaymentInputs, today)
  const settled = new Map(allocated.map((l) => [l.loanId, l.isSettled]))

  const toClose = loans.filter((l) => l.status === 'active' && settled.get(l.id) === true).map((l) => l.id)
  const toReopen = loans.filter((l) => l.status === 'closed' && settled.get(l.id) === false).map((l) => l.id)

  if (toClose.length > 0) {
    await admin.from('employee_loans').update({ status: 'closed' }).in('id', toClose).eq('tenant_id', tenantId)
  }
  if (toReopen.length > 0) {
    await admin.from('employee_loans').update({ status: 'active' }).in('id', toReopen).eq('tenant_id', tenantId)
  }
}
