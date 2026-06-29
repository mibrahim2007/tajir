import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/page-header'
import { TableCard, Th, Td, EmptyState } from '@/components/table-card'
import { CreateItemTypeSheet } from './create-item-type-sheet'
import { ItemTypeActions } from './item-type-actions'

export default async function ItemTypesPage() {
  const { tenantId, role } = await requireAuth()
  const admin = createAdminClient()
  const isOwner = role === 'owner'

  const [{ data: itemTypes }, { data: counts }] = await Promise.all([
    admin
      .from('item_types')
      .select('id, name, created_at')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true }),
    admin
      .from('inventory_lots')
      .select('item_type_id')
      .eq('tenant_id', tenantId)
      .not('item_type_id', 'is', null),
  ])

  const countMap: Record<string, number> = {}
  for (const row of counts ?? []) {
    if (row.item_type_id) countMap[row.item_type_id] = (countMap[row.item_type_id] ?? 0) + 1
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Item Types"
        subtitle="Categorize your stock items (e.g. Yarn, Grey Fabric)"
        action={isOwner ? <CreateItemTypeSheet /> : undefined}
      />
      <TableCard>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Name</Th>
              <Th>Stock Items</Th>
              {isOwner && <Th className="w-24" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(itemTypes ?? []).length === 0 ? (
              <tr>
                <td colSpan={isOwner ? 3 : 2}>
                  <EmptyState message="No item types yet. Add one to start categorizing your stock." />
                </td>
              </tr>
            ) : (itemTypes ?? []).map((it) => (
              <tr key={it.id} className="hover:bg-secondary/50 transition-colors">
                <Td strong>{it.name}</Td>
                <Td muted>{countMap[it.id] ?? 0}</Td>
                {isOwner && <Td><ItemTypeActions id={it.id} name={it.name} /></Td>}
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  )
}
