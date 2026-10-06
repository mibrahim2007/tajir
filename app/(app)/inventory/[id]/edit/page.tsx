import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { EditInventoryLotForm } from '../../edit-inventory-lot-form'

export default async function EditStockItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()

  const [{ data: lot }, { data: itemTypes }] = await Promise.all([
    admin
      .from('inventory_lots')
      .select('id, name, sku, code, count, unit_of_measure, item_type_id, fiber, lot')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    admin.from('item_types').select('id, name, parent_id').eq('tenant_id', tenantId).order('name'),
  ])

  if (!lot) notFound()

  // All types (with parent link) for the grouped Item Type LOV.
  const safeItemTypes = (itemTypes ?? []).map((t) => ({ id: t.id, name: t.name, parentId: t.parent_id }))

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit Stock Item</h1>
        <p className="text-sm text-muted-foreground mt-1">Update this stock item&rsquo;s details and textile attributes.</p>
      </div>
      <EditInventoryLotForm
        lot={{
          id: lot.id,
          name: lot.name,
          sku: lot.sku,
          code: lot.code,
          count: String(lot.count ?? ''),
          unitOfMeasure: lot.unit_of_measure ?? null,
          itemTypeId: lot.item_type_id ?? null,
          fiber: lot.fiber,
          lot: lot.lot,
        }}
        itemTypes={safeItemTypes}
      />
    </div>
  )
}
