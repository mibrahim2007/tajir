import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateLotForm } from '../create-lot-form'

export default async function NewStockItemPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const { data: itemTypes } = await admin
    .from('item_types')
    .select('id, name, parent_id')
    .eq('tenant_id', tenantId)
    .order('name')

  // All types (with parent link) for the grouped Item Type LOV.
  const safeItemTypes = (itemTypes ?? []).map((t) => ({ id: t.id, name: t.name, parentId: t.parent_id }))

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Stock Item</h1>
        <p className="text-sm text-muted-foreground mt-1">Add a new inventory lot with its textile attributes.</p>
      </div>
      <CreateLotForm itemTypes={safeItemTypes} />
    </div>
  )
}
