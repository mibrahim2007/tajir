import { requireAuth } from '@/lib/auth/require-auth'
import { CreateOwnerForm } from '../create-owner-form'

export default async function NewOwnerPage() {
  const { role } = await requireAuth()
  // Owner equity — capital and drawings — is owner-only.
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Owner</h1>
        <p className="text-sm text-muted-foreground mt-1">Add a partner to track their capital and drawings separately.</p>
      </div>
      <CreateOwnerForm />
    </div>
  )
}
