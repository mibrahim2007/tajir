import { createAdminClient } from '@/lib/supabase/admin'

// Per-employee loan statement — the single source of truth for the ledger page
// and the employees-list / report outstanding figures.
//
// Built from source documents (loans + repayments) like the customer/supplier
// ledgers, NOT from GL lines. Sign convention (asset frame):
//   balance > 0  →  the employee owes us (outstanding loan)
//   balance < 0  →  the employee has over-repaid (they are in credit)
//
// Outstanding = Σ disbursed_pkr − Σ repaid_pkr across ALL of the employee's
// loans, so a second loan taken mid-repayment is inherently correct and needs
// no per-loan allocation.

export type LoanLedgerRow = {
  id: string
  kind: 'disbursement' | 'repayment'
  loanId: string
  date: string
  description: string
  debit: number
  credit: number
  balance: number
  source?: string // 'manual' | 'payroll' (repayments only)
}

export type EmployeeLoanLedger = {
  rows: LoanLedgerRow[]
  totalDisbursed: number
  totalRepaid: number
  outstanding: number
}

export async function buildEmployeeLoanLedger(
  tenantId: string,
  employeeId: string,
): Promise<EmployeeLoanLedger> {
  const admin = createAdminClient()

  const [{ data: rawLoans }, { data: rawRepayments }] = await Promise.all([
    admin
      .from('employee_loans')
      .select('id, date:disbursement_date, pkr_equivalent, currency_code, principal, serial_number, installment_count, status')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId)
      .neq('status', 'void'),
    admin
      .from('loan_repayments')
      .select('id, date, pkr_equivalent, loan_id, payment_method_note, serial_number, source')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId),
  ])

  const loans = rawLoans ?? []
  const repayments = rawRepayments ?? []

  type Entry =
    | { kind: 'disbursement'; date: string; entry: (typeof loans)[number] }
    | { kind: 'repayment'; date: string; entry: (typeof repayments)[number] }

  const entries: Entry[] = [
    ...loans.map((e) => ({ kind: 'disbursement' as const, date: e.date, entry: e })),
    ...repayments.map((e) => ({ kind: 'repayment' as const, date: e.date, entry: e })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const rows: LoanLedgerRow[] = []
  let running = 0
  let totalDisbursed = 0
  let totalRepaid = 0

  for (const item of entries) {
    if (item.kind === 'disbursement') {
      const amount = item.entry.pkr_equivalent
      running += amount
      totalDisbursed += amount
      const ref = item.entry.serial_number ? `${item.entry.serial_number} · ` : ''
      const plan = item.entry.installment_count
        ? ` (${item.entry.installment_count} monthly installments)`
        : ' (ad-hoc repayment)'
      rows.push({
        id: item.entry.id,
        kind: 'disbursement',
        loanId: item.entry.id,
        date: item.date,
        description: `${ref}Loan Disbursed${plan}`,
        debit: amount,
        credit: 0,
        balance: running,
      })
    } else {
      const amount = item.entry.pkr_equivalent
      running -= amount
      totalRepaid += amount
      const ref = item.entry.serial_number ? `${item.entry.serial_number} · ` : ''
      rows.push({
        id: item.entry.id,
        kind: 'repayment',
        loanId: item.entry.loan_id ?? '',
        date: item.date,
        description: `${ref}Repayment${item.entry.payment_method_note ? ` — ${item.entry.payment_method_note}` : ''}`,
        debit: 0,
        credit: amount,
        balance: running,
        source: item.entry.source ?? 'manual',
      })
    }
  }

  return { rows, totalDisbursed, totalRepaid, outstanding: running }
}
