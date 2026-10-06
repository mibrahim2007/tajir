import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { SetPriceForm } from '../set-price-form'

export default async function NewPricePage() {
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()

  const [{ data: customers }, { data: stockItems }] = await Promise.all([
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
  ])

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Set Customer Price</h1>
        <p className="text-sm text-muted-foreground mt-1">Set a custom rate for a customer and stock item.</p>
      </div>
      <SetPriceForm customers={customers ?? []} stockItems={stockItems ?? []} />
    </div>
  )
}
