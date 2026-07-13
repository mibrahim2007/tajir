import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PrintButton } from '@/components/print-button'
import { formatPKR } from '@/lib/utils/currency'
import { allocateEmployeeLoans, type LoanInput, type RepaymentInput } from '@/lib/loans/allocation'

// Tenant-wide employee-loans report: outstanding + overdue per employee,
// computed from the same FIFO allocation used by the ledger.
export default async function EmployeeLoansReportPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawEmployees }, { data: rawLoans }, { data: rawRepayments }] = await Promise.all([
    admin.from('employees').select('id, name, designation').eq('tenant_id', tenantId).order('name'),
    admin.from('employee_loans')
      .select('id, employee_id, disbursement_date, exchange_rate, pkr_equivalent, loan_installments(installment_no, due_date, amount)')
      .eq('tenant_id', tenantId).neq('status', 'void'),
    admin.from('loan_repayments').select('id, employee_id, date, pkr_equivalent, loan_id').eq('tenant_id', tenantId),
  ])

  const employees = rawEmployees ?? []
  const loans = rawLoans ?? []
  const repayments = rawRepayments ?? []

  const rows = employees.map((e) => {
    const empLoans: LoanInput[] = loans.filter((l) => l.employee_id === e.id).map((l) => ({
      id: l.id,
      disbursementDate: l.disbursement_date,
      principalPkr: l.pkr_equivalent,
      installments: ((l.loan_installments ?? []) as { installment_no: number; due_date: string; amount: number }[]).map((i) => ({
        installmentNo: i.installment_no, dueDate: i.due_date, amountPkr: i.amount * l.exchange_rate,
      })),
    }))
    const empRepayments: RepaymentInput[] = repayments.filter((r) => r.employee_id === e.id).map((r) => ({
      id: r.id, date: r.date, pkr: r.pkr_equivalent, loanId: r.loan_id ?? null,
    }))
    const { totalOutstandingPkr, totalOverduePkr } = allocateEmployeeLoans(empLoans, empRepayments, today)
    const activeLoans = empLoans.length
    return { id: e.id, name: e.name, designation: e.designation as string | null, outstanding: totalOutstandingPkr, overdue: totalOverduePkr, activeLoans }
  }).filter((r) => r.activeLoans > 0 || r.outstanding !== 0)

  rows.sort((a, b) => b.overdue - a.overdue || b.outstanding - a.outstanding)

  const totalOutstanding = rows.reduce((s, r) => s + Math.max(0, r.outstanding), 0)
  const totalOverdue = rows.reduce((s, r) => s + r.overdue, 0)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Employee Loans</h1>
          <p className="text-sm text-muted-foreground mt-1">Outstanding &amp; overdue per employee</p>
        </div>
        <PrintButton />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">Total Outstanding</p>
          <p className="text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">{formatPKR(totalOutstanding)}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">Total Overdue</p>
          <p className={`text-xl font-semibold tabular-nums ${totalOverdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{formatPKR(totalOverdue)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No outstanding employee loans.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Employee</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Outstanding (PKR)</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Overdue (PKR)</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium">{r.name}</span>
                      {r.designation && <span className="text-muted-foreground text-xs ml-2">{r.designation}</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={r.outstanding > 0 ? 'text-amber-600 dark:text-amber-400' : r.outstanding < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                        {formatPKR(Math.abs(r.outstanding))}{r.outstanding < 0 ? ' CR' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.overdue > 0 ? <span className="text-red-600 dark:text-red-400 font-medium">{formatPKR(r.overdue)}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/employees/${r.id}/ledger`} className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground">Ledger</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
