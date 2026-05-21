import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreatePurchaseForm } from './create-purchase-form'

export default async function NewPurchasePage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: rawSuppliers }, { data: rawLots }] = await Promise.all([
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    admin.from('inventory_lots').select('id, name, count').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
  ])

  const supplierList = rawSuppliers ?? []
  const lotList = rawLots ?? []

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-1">New Purchase</h1>
      <p className="text-sm text-muted-foreground mb-6">Record a purchase from a supplier.</p>
      <CreatePurchaseForm suppliers={supplierList} lots={lotList} />
    </div>
  )
}
