import { Fragment } from 'react'
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
      .select('id, name, parent_id, created_at')
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

  // Group sub-types under their parent; only top-level types (parent_id null)
  // render as primary rows, each followed by its sub-type rows.
  const all = itemTypes ?? []
  const childrenByParent = new Map<string, { id: string; name: string }[]>()
  for (const t of all) {
    if (t.parent_id) {
      const list = childrenByParent.get(t.parent_id) ?? []
      list.push({ id: t.id, name: t.name })
      childrenByParent.set(t.parent_id, list)
    }
  }
  const topTypes = all.filter((t) => !t.parent_id)

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
            {topTypes.length === 0 ? (
              <tr>
                <td colSpan={isOwner ? 3 : 2}>
                  <EmptyState message="No item types yet. Add one to start categorizing your stock." />
                </td>
              </tr>
            ) : topTypes.map((it) => {
              const subs = childrenByParent.get(it.id) ?? []
              return (
                <Fragment key={it.id}>
                  <tr className="hover:bg-secondary/50 transition-colors">
                    <Td strong>{it.name}</Td>
                    <Td muted>{countMap[it.id] ?? 0}</Td>
                    {isOwner && <Td><ItemTypeActions id={it.id} name={it.name} subTypes={subs} /></Td>}
                  </tr>
                  {subs.map((s) => (
                    <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                      <Td>
                        <span className="text-muted-foreground pl-4">└ {s.name}</span>
                      </Td>
                      <Td muted>{countMap[s.id] ?? 0}</Td>
                      {isOwner && <Td />}
                    </tr>
                  ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </TableCard>
    </div>
  )
}
