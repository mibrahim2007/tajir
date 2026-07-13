import { createAdminClient } from '@/lib/supabase/admin'
import { allocateEmployeeLoans, type LoanInput, type RepaymentInput, type AllocatedLoan } from '@/lib/loans/allocation'

// Per-loan schedule + settlement detail for one employee (Phase 2). Wraps the
// pure FIFO allocation with display metadata (serial, currency, status). Powers
// the schedule/overdue panel on the employee ledger.

export type LoanDetail = AllocatedLoan & {
  serialNumber: string | null
  currencyCode: string
  disbursementDate: string
  status: string
  installmentCount: number | null
}

export type EmployeeLoanDetail = {
  loans: LoanDetail[]
  totalOutstandingPkr: number
  totalOverduePkr: number
}

export async function buildEmployeeLoanDetail(
  tenantId: string,
  employeeId: string,
): Promise<EmployeeLoanDetail> {
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawLoans }, { data: rawRepayments }] = await Promise.all([
    admin.from('employee_loans')
      .select('id, serial_number, currency_code, exchange_rate, pkr_equivalent, disbursement_date, status, installment_count, loan_installments(installment_no, due_date, amount)')
      .eq('employee_id', employeeId).eq('tenant_id', tenantId).neq('status', 'void')
      .order('disbursement_date', { ascending: true }),
    admin.from('loan_repayments')
      .select('id, date, pkr_equivalent, loan_id')
      .eq('employee_id', employeeId).eq('tenant_id', tenantId),
  ])

  const loans = rawLoans ?? []

  const loanInputs: LoanInput[] = loans.map((l) => ({
    id: l.id,
    disbursementDate: l.disbursement_date,
    principalPkr: l.pkr_equivalent,
    // Installment amounts are stored in loan currency; convert to PKR-equivalent.
    installments: ((l.loan_installments ?? []) as { installment_no: number; due_date: string; amount: number }[]).map((i) => ({
      installmentNo: i.installment_no,
      dueDate: i.due_date,
      amountPkr: i.amount * l.exchange_rate,
    })),
  }))
  const repaymentInputs: RepaymentInput[] = (rawRepayments ?? []).map((r) => ({
    id: r.id, date: r.date, pkr: r.pkr_equivalent, loanId: r.loan_id ?? null,
  }))

  const { loans: allocated, totalOutstandingPkr, totalOverduePkr } = allocateEmployeeLoans(loanInputs, repaymentInputs, today)

  const meta = new Map(loans.map((l) => [l.id, l]))
  const detail: LoanDetail[] = allocated.map((a) => {
    const m = meta.get(a.loanId)!
    return {
      ...a,
      serialNumber: m.serial_number,
      currencyCode: m.currency_code,
      disbursementDate: m.disbursement_date,
      status: m.status,
      installmentCount: m.installment_count,
    }
  })

  return { loans: detail, totalOutstandingPkr, totalOverduePkr }
}
