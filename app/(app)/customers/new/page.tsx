import { requireAuth } from '@/lib/auth/require-auth'
import { CreateCustomerForm } from '../create-customer-form'

export default async function NewCustomerPage() {
  await requireAuth()

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Customer</h1>
        <p className="text-sm text-muted-foreground mt-1">Add a customer and optional opening balance.</p>
      </div>
      <CreateCustomerForm />
    </div>
  )
}
