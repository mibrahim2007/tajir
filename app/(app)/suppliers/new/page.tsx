import { requireAuth } from '@/lib/auth/require-auth'
import { CreateSupplierForm } from '../create-supplier-form'

export default async function NewSupplierPage() {
  await requireAuth()

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Supplier</h1>
        <p className="text-sm text-muted-foreground mt-1">Add a supplier and optional opening balance.</p>
      </div>
      <CreateSupplierForm />
    </div>
  )
}
