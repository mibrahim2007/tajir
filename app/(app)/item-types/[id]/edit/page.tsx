import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { EditItemTypeForm } from '../../edit-item-type-form'

export default async function EditItemTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()

  const [{ data: itemType }, { data: subTypes }] = await Promise.all([
    admin
      .from('item_types')
      .select('id, name, parent_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    admin
      .from('item_types')
      .select('id, name')
      .eq('parent_id', id)
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true }),
  ])

  // Only top-level types are editable; sub-types are managed through their parent.
  if (!itemType || itemType.parent_id) notFound()

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit Item Type</h1>
        <p className="text-sm text-muted-foreground mt-1">Rename this type and manage its sub-types.</p>
      </div>
      <EditItemTypeForm id={itemType.id} name={itemType.name} subTypes={subTypes ?? []} />
    </div>
  )
}
