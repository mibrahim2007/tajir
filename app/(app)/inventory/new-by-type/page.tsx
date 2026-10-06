import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateItemsByType } from '../create-items-by-type'

export default async function NewItemsByTypePage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const { data: itemTypes } = await admin
    .from('item_types')
    .select('id, name, parent_id')
    .eq('tenant_id', tenantId)
    .order('name')

  // The "Create Items by Type" flow files a batch under one top-level category.
  const topItemTypes = (itemTypes ?? []).filter((t) => !t.parent_id).map((t) => ({ id: t.id, name: t.name }))

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Create Items by Type</h1>
        <p className="text-sm text-muted-foreground mt-1">Add a batch of stock items filed under one item type.</p>
      </div>
      <CreateItemsByType itemTypes={topItemTypes} />
    </div>
  )
}
