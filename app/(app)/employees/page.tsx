import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateEmployeeForm } from './create-employee-form'
import { EmployeesList } from './employees-list'

export default async function EmployeesPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: allEmployees }, { data: allLoans }, { data: allRepayments }] = await Promise.all([
    admin.from('employees').select('id, name, designation, is_active, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    admin.from('employee_loans').select('employee_id, pkr_equivalent').eq('tenant_id', tenantId).neq('status', 'void'),
    admin.from('loan_repayments').select('employee_id, pkr_equivalent').eq('tenant_id', tenantId),
  ])

  const employees = allEmployees ?? []
  const loans = allLoans ?? []
  const repayments = allRepayments ?? []

  const outstandingByEmployee = new Map<string, number>()
  for (const e of employees) {
    const disbursed = loans.filter((l) => l.employee_id === e.id).reduce((s, l) => s + l.pkr_equivalent, 0)
    const repaid = repayments.filter((r) => r.employee_id === e.id).reduce((s, r) => s + r.pkr_equivalent, 0)
    outstandingByEmployee.set(e.id, disbursed - repaid)
  }

  const employeeItems = employees.map((e) => ({
    id: e.id,
    name: e.name,
    designation: e.designation as string | null,
    isActive: e.is_active as boolean,
    outstanding: outstandingByEmployee.get(e.id) ?? 0,
  }))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground mt-1">{employees.length} employee{employees.length !== 1 ? 's' : ''} · loans &amp; advances</p>
        </div>
        <CreateEmployeeForm />
      </div>

      {employees.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No employees yet. Add an employee to start recording loans and advances.</p>
        </div>
      ) : (
        <EmployeesList employees={employeeItems} />
      )}
    </div>
  )
}
