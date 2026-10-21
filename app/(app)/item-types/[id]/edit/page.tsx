import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeFormula } from '@/lib/item-formula'
import { EditItemTypeForm } from '../../edit-item-type-form'

// Trading tables whose lines lock the formula of their items' type.
const LINE_TABLES = ['purchase_orders', 'sales_orders', 'purchase_returns', 'sale_returns'] as const

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
      .select('id, name, parent_id, formula, stock_unit, pack_unit, std_pack_weight, track_grade, track_lot')
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

  // Same rule the edit action enforces: once any item of the type (or a
  // sub-type) has been traded, its formula is fixed.
  const { data: lots } = await admin
    .from('inventory_lots').select('id').eq('tenant_id', tenantId)
    .in('item_type_id', [id, ...(subTypes ?? []).map((s) => s.id)])
  const lotIds = (lots ?? []).map((l) => l.id)
  let formulaLocked = false
  if (lotIds.length > 0) {
    const counts = await Promise.all(LINE_TABLES.map((t) =>
      admin.from(t).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('stock_item_id', lotIds)))
    formulaLocked = counts.some((c) => (c.count ?? 0) > 0)
  }

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit Item Type</h1>
        <p className="text-sm text-muted-foreground mt-1">Rename this type, set its formula and manage its sub-types.</p>
      </div>
      <EditItemTypeForm
        id={itemType.id}
        name={itemType.name}
        subTypes={subTypes ?? []}
        formulaLocked={formulaLocked}
        profile={{
          formula:       normalizeFormula(itemType.formula),
          stockUnit:     itemType.stock_unit,
          packUnit:      itemType.pack_unit,
          stdPackWeight: itemType.std_pack_weight == null ? null : Number(itemType.std_pack_weight),
          trackGrade:    itemType.track_grade,
          trackLot:      itemType.track_lot,
        }}
      />
    </div>
  )
}
