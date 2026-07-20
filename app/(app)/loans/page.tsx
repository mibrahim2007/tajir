import { requireAuth } from '@/lib/auth/require-auth'
import { PendingChequesPanel } from "@/components/pending-cheques-panel"
import { createAdminClient } from '@/lib/supabase/admin'
import { RoleGate } from '@/components/role-gate'
import { DisburseLoanForm } from '@/app/(app)/employees/[id]/disburse-loan-form'
import { LoansList, type LoanListItem } from './loans-list'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'
import { allocateEmployeeLoans, type LoanInput, type RepaymentInput } from '@/lib/loans/allocation'

export default async function LoansPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawEmployees }, { data: rawLoans }, { data: rawRepayments }, { data: rawBanks }, nextLoanSerial] = await Promise.all([
    admin.from('employees').select('id, name, is_active').eq('tenant_id', tenantId).order('name'),
    admin.from('employee_loans')
      .select('id, employee_id, serial_number, principal, currency_code, pkr_equivalent, disbursement_date, installment_count, status')
      .eq('tenant_id', tenantId).neq('status', 'void').order('disbursement_date', { ascending: false }),
    admin.from('loan_repayments').select('employee_id, loan_id, date, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
    peekNextDocumentSerial(admin, tenantId, 'employee_loan', today),
  ])

  const employees = rawEmployees ?? []
  const loans = rawLoans ?? []
  const repayments = rawRepayments ?? []
  const banks = rawBanks ?? []
  const nameById = new Map(employees.map((e) => [e.id, e.name]))

  // Per-loan outstanding: group by employee and run FIFO allocation once each.
  const outstandingByLoan = new Map<string, number>()
  const byEmployee = new Map<string, typeof loans>()
  for (const l of loans) {
    if (!byEmployee.has(l.employee_id)) byEmployee.set(l.employee_id, [])
    byEmployee.get(l.employee_id)!.push(l)
  }
  for (const [employeeId, empLoans] of byEmployee) {
    const loanInputs: LoanInput[] = empLoans.map((l) => ({ id: l.id, disbursementDate: l.disbursement_date, principalPkr: l.pkr_equivalent, installments: [] }))
    const empRepayments: RepaymentInput[] = repayments.filter((r) => r.employee_id === employeeId).map((r) => ({ id: `${r.loan_id ?? ''}-${r.date}`, date: r.date, pkr: r.pkr_equivalent, loanId: r.loan_id ?? null }))
    const { loans: allocated } = allocateEmployeeLoans(loanInputs, empRepayments, today)
    for (const a of allocated) outstandingByLoan.set(a.loanId, a.outstandingPkr)
  }

  const items: LoanListItem[] = loans.map((l) => ({
    id: l.id,
    employeeId: l.employee_id,
    employeeName: nameById.get(l.employee_id) ?? 'Unknown',
    serialNumber: l.serial_number,
    currencyCode: l.currency_code,
    principal: Number(l.principal),
    disbursementDate: l.disbursement_date,
    installmentCount: l.installment_count,
    status: l.status,
    outstanding: outstandingByLoan.get(l.id) ?? l.pkr_equivalent,
  }))

  const activeEmployees = employees.filter((e) => e.is_active).map((e) => ({ id: e.id, name: e.name }))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PendingChequesPanel direction="out" className="mb-4" />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Loans</h1>
          <p className="text-sm text-muted-foreground mt-1">{loans.length} loan{loans.length !== 1 ? 's' : ''} · advances to employees</p>
        </div>
        <RoleGate allowedRoles={['owner']}>
          <DisburseLoanForm employees={activeEmployees} today={today} nextSerial={nextLoanSerial} banks={banks} />
        </RoleGate>
      </div>

      {loans.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No loans yet. Use “Disburse Loan” to record an advance to an employee.</p>
        </div>
      ) : (
        <LoansList loans={items} />
      )}
    </div>
  )
}
