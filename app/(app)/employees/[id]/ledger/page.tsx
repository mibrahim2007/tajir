import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { DisburseLoanForm } from '@/app/(app)/employees/[id]/disburse-loan-form'
import { RecordRepaymentForm } from '@/app/(app)/employees/[id]/record-repayment-form'
import { SalaryDeductionForm } from '@/app/(app)/employees/[id]/salary-deduction-form'
import { PrintButton } from '@/components/print-button'
import { RoleGate } from '@/components/role-gate'
import { DeleteButton } from '@/components/delete-button'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'
import { buildEmployeeLoanLedger } from '@/lib/ledger/employee-loans'
import { buildEmployeeLoanDetail } from '@/lib/ledger/employee-loan-detail'
import type { InstallmentStatus } from '@/lib/loans/allocation'
import { deleteLoanRepaymentAction } from '@/app/actions/delete-loan-repayment'
import { voidEmployeeLoanAction } from '@/app/actions/void-employee-loan'

type Props = { params: Promise<{ id: string }> }

const STATUS_STYLES: Record<InstallmentStatus, { label: string; cls: string }> = {
  paid:    { label: 'Paid',    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  partial: { label: 'Partial', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' },
  overdue: { label: 'Overdue', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  due:     { label: 'Due',     cls: 'bg-muted text-muted-foreground' },
}

export default async function EmployeeLedgerPage({ params }: Props) {
  const { tenantId } = await requireAuth()
  const { id } = await params
  const today = new Date().toISOString().split('T')[0]

  const admin = createAdminClient()

  const { data: employeeRow } = await admin
    .from('employees')
    .select('id, name, designation, monthly_salary')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!employeeRow) notFound()

  const [ledger, detail, { data: rawBanks }, { data: rawLoans }, nextLoanSerial, nextRepaymentSerial] = await Promise.all([
    buildEmployeeLoanLedger(tenantId, id),
    buildEmployeeLoanDetail(tenantId, id),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
    admin.from('employee_loans').select('id, serial_number, principal, currency_code, disbursement_date')
      .eq('employee_id', id).eq('tenant_id', tenantId).eq('status', 'active').order('disbursement_date', { ascending: true }),
    peekNextDocumentSerial(admin, tenantId, 'employee_loan', today),
    peekNextDocumentSerial(admin, tenantId, 'loan_repayment', today),
  ])

  const banks = rawBanks ?? []
  const loanOptions = (rawLoans ?? []).map((l) => ({
    id: l.id,
    label: `${l.serial_number ? `${l.serial_number} · ` : ''}${l.currency_code} ${Number(l.principal).toLocaleString()} · ${formatPKTDate(new Date(l.disbursement_date))}`,
  }))

  const { rows, outstanding, totalDisbursed, totalRepaid } = ledger
  const scheduledLoans = detail.loans.filter((l) => l.installments.length > 0)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{employeeRow.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Employee Loan Ledger{employeeRow.designation ? ` · ${employeeRow.designation}` : ''}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <PrintButton />
          <RecordRepaymentForm employeeId={id} today={today} nextSerial={nextRepaymentSerial} banks={banks} loans={loanOptions} />
          <RoleGate allowedRoles={['owner']}>
            <SalaryDeductionForm employeeId={id} today={today} monthlySalary={Number(employeeRow.monthly_salary) || 0} loans={loanOptions} />
            <DisburseLoanForm employeeId={id} today={today} nextSerial={nextLoanSerial} banks={banks} />
          </RoleGate>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">{outstanding < 0 ? 'Over-repaid (credit)' : 'Outstanding'}</p>
          <p className={`text-xl font-semibold tabular-nums ${outstanding > 0 ? 'text-amber-600 dark:text-amber-400' : outstanding < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
            {formatPKR(Math.abs(outstanding))}{outstanding < 0 ? ' CR' : ''}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">Overdue</p>
          <p className={`text-xl font-semibold tabular-nums ${detail.totalOverduePkr > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
            {formatPKR(detail.totalOverduePkr)}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">Total Disbursed</p>
          <p className="text-xl font-semibold tabular-nums">{formatPKR(totalDisbursed)}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">Total Repaid</p>
          <p className="text-xl font-semibold tabular-nums">{formatPKR(totalRepaid)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No loans yet. Disburse a loan to start tracking repayments.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Description</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Disbursed (PKR)</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Repaid (PKR)</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Balance (PKR)</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className={`hover:bg-secondary/50 transition-colors ${row.kind === 'repayment' ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(row.date))}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.description}
                      {row.source === 'payroll' && (
                        <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 align-middle">Salary</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.debit > 0 ? formatPKR(row.debit) : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.credit > 0 ? formatPKR(row.credit) : '—'}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${row.balance > 0 ? 'text-amber-600 dark:text-amber-400' : row.balance < 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                      {formatPKR(row.balance)}
                    </td>
                    <td className="px-4 py-3">
                      <RoleGate allowedRoles={['owner']}>
                        {row.kind === 'repayment' ? (
                          <DeleteButton
                            description="Delete this repayment? Its GL entry is reversed and any settled loan re-opens."
                            onDelete={deleteLoanRepaymentAction.bind(null, { id: row.id })}
                          />
                        ) : (
                          <DeleteButton
                            label="Void"
                            description="Void this loan? Its disbursement GL entry is reversed. Blocked if repayments are allocated to it."
                            onDelete={voidEmployeeLoanAction.bind(null, { id: row.id })}
                          />
                        )}
                      </RoleGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {scheduledLoans.length > 0 && (
        <div className="mt-8 space-y-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Installment Schedules</h2>
          {scheduledLoans.map((loan) => (
            <div key={loan.loanId} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
                <div className="text-sm font-medium">
                  {loan.serialNumber ?? 'Loan'}
                  <span className="text-muted-foreground font-normal"> · {formatPKTDate(new Date(loan.disbursementDate))} · {loan.installmentCount} installments</span>
                </div>
                <div className="text-sm tabular-nums">
                  <span className="text-muted-foreground mr-2">Outstanding</span>
                  <span className={loan.outstandingPkr > 0.01 ? 'font-semibold text-amber-600 dark:text-amber-400' : 'font-semibold text-emerald-600 dark:text-emerald-400'}>
                    {loan.outstandingPkr <= 0.01 ? 'Settled' : formatPKR(loan.outstandingPkr)}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b">
                    <tr>
                      <th className="text-left px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">#</th>
                      <th className="text-left px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Due Date</th>
                      <th className="text-right px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Amount (PKR)</th>
                      <th className="text-right px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Paid (PKR)</th>
                      <th className="text-right px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loan.installments.map((inst) => {
                      const s = STATUS_STYLES[inst.status]
                      return (
                        <tr key={inst.installmentNo} className={inst.status === 'overdue' ? 'bg-red-50/40 dark:bg-red-950/20' : ''}>
                          <td className="px-4 py-2 tabular-nums text-muted-foreground">{inst.installmentNo}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{formatPKTDate(new Date(inst.dueDate))}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatPKR(inst.amountPkr)}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{inst.paidPkr > 0 ? formatPKR(inst.paidPkr) : '—'}</td>
                          <td className="px-4 py-2 text-right">
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
