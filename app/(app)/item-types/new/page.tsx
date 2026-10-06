import { requireAuth } from '@/lib/auth/require-auth'
import { CreateItemTypeForm } from '../create-item-type-form'

export default async function NewItemTypePage() {
  const { role } = await requireAuth()
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Item Type</h1>
        <p className="text-sm text-muted-foreground mt-1">Add a category for your stock items, with optional sub-types.</p>
      </div>
      <CreateItemTypeForm />
    </div>
  )
}
