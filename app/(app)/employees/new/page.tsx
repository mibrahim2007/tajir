import { requireAuth } from '@/lib/auth/require-auth'
import { CreateEmployeeForm } from '../create-employee-form'

export default async function NewEmployeePage() {
  await requireAuth()

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Employee</h1>
        <p className="text-sm text-muted-foreground mt-1">Add an employee to track loans and advances.</p>
      </div>
      <CreateEmployeeForm />
    </div>
  )
}
