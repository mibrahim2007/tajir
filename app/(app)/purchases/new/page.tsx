import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreatePurchaseForm } from './create-purchase-form'

export default async function NewPurchasePage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawSuppliers }, { data: rawLots }] = await Promise.all([
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    admin.from('inventory_lots').select('id, name, count').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
  ])

  const supplierList = rawSuppliers ?? []
  const lotList = (rawLots ?? []).map((l) => ({ ...l, count: String(l.count ?? '') }))

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">New Purchase</h1>
        <p className="text-sm text-muted-foreground mt-1">Record a purchase from a supplier.</p>
      </div>
      <CreatePurchaseForm today={today} suppliers={supplierList} lots={lotList} />
    </div>
  )
}
