import { notFound } from 'next/navigation'
import { PeriodLockBanner } from '@/components/period-lock-banner'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKTDate } from '@/lib/utils/dates'
import { SalaryDeductionForm } from '../salary-deduction-form'

export default async function SalaryDeductionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  // Salary deductions were owner-only on the ledger (RoleGate).
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: employee } = await admin
    .from('employees')
    .select('id, name, monthly_salary')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!employee) notFound()

  const { data: rawLoans } = await admin
    .from('employee_loans').select('id, serial_number, principal, currency_code, disbursement_date')
    .eq('employee_id', id).eq('tenant_id', tenantId).eq('status', 'active').order('disbursement_date', { ascending: true })

  const loanOptions = (rawLoans ?? []).map((l) => ({
    id: l.id,
    label: `${l.serial_number ? `${l.serial_number} · ` : ''}${l.currency_code} ${Number(l.principal).toLocaleString()} · ${formatPKTDate(new Date(l.disbursement_date))}`,
  }))

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <PeriodLockBanner className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Recover via Salary Deduction</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Withhold part of {employee.name}&apos;s salary this month against the loan. No cash moves — it posts Salaries &amp; Wages against the loan balance.
        </p>
      </div>
      <SalaryDeductionForm employeeId={id} today={today} monthlySalary={Number(employee.monthly_salary) || 0} loans={loanOptions} />
    </div>
  )
}
