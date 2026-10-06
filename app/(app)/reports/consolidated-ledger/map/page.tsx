import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { MapAccountsForm } from '../map-accounts-form'

export default async function MapAccountsPage() {
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()
  const [{ data: customers }, { data: suppliers }] = await Promise.all([
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name'),
  ])

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Map Customer to Supplier</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Link a customer account to its supplier counterpart to consolidate their ledgers into one net statement.
        </p>
      </div>
      <MapAccountsForm customers={customers ?? []} suppliers={suppliers ?? []} />
    </div>
  )
}
