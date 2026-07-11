import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { BusinessProfileForm } from './business-profile-form'

export default async function BusinessSettingsPage() {
  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') redirect('/dashboard')

  const tenant = await getTenant(tenantId)

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Business Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your business name and NTN appear in the header of invoice and voucher printouts.
        </p>
      </div>
      <BusinessProfileForm name={tenant.name} ntn={tenant.ntn ?? ''} />
    </div>
  )
}
