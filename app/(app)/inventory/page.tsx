import { Suspense } from 'react'
import Link from 'next/link'
import { Barcode } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateLotFormWrapper } from './form-wrappers'
import { CreateItemsByTypeWrapper } from './form-wrappers'
import { EditInventoryLotFormWrapper } from './form-wrappers'
import { InventoryFilters } from './inventory-filters'
import { BulkLabelPrint } from './bulk-label-print'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deleteInventoryLotAction } from '@/app/actions/delete-inventory-lot'

const PAGE_SIZE = 50

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const { tenantId } = await requireAuth()
  const params = await searchParams

  const filterCount    = typeof params.count === 'string' ? params.count    : undefined
  const filterType     = typeof params.type  === 'string' ? params.type     : undefined
  const filterFiber    = typeof params.fiber === 'string' ? params.fiber    : undefined
  const filterLot      = typeof params.lot   === 'string' ? params.lot      : undefined
  const page           = typeof params.page  === 'string' ? Math.max(1, parseInt(params.page, 10) || 1) : 1

  const admin = createAdminClient()

  let dataQuery = admin
    .from('inventory_lots')
    .select('id, name, sku, code, count, unit_of_measure, type, fiber, lot, current_quantity, item_type_id, item_types(id, name)')
    .eq('tenant_id', tenantId)

  let countQuery = admin
    .from('inventory_lots')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  if (filterCount) { dataQuery = dataQuery.ilike('count', `%${filterCount}%`); countQuery = countQuery.ilike('count', `%${filterCount}%`) }
  if (filterType)  { dataQuery = dataQuery.eq('item_type_id', filterType);      countQuery = countQuery.eq('item_type_id', filterType) }
  if (filterFiber) { dataQuery = dataQuery.ilike('fiber', `%${filterFiber}%`); countQuery = countQuery.ilike('fiber', `%${filterFiber}%`) }
  if (filterLot)   { dataQuery = dataQuery.ilike('lot',   `%${filterLot}%`);   countQuery = countQuery.ilike('lot',   `%${filterLot}%`) }

  const [{ data: lots }, { count: totalRaw }, { data: itemTypes }] = await Promise.all([
    dataQuery.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    countQuery,
    admin.from('item_types').select('id, name').eq('tenant_id', tenantId).order('name'),
  ])

  const totalCount = totalRaw ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const hasFilters = filterCount || filterType || filterFiber || filterLot
  const safeItemTypes = itemTypes ?? []

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount} stock item{totalCount !== 1 ? 's' : ''}
            {hasFilters ? ' (filtered)' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateItemsByTypeWrapper itemTypes={safeItemTypes} />
          <CreateLotFormWrapper itemTypes={safeItemTypes} />
        </div>
      </div>

      <Suspense>
        <InventoryFilters itemTypes={safeItemTypes} />
      </Suspense>

      {!lots || lots.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            {hasFilters
              ? 'No stock items match your filters'
              : 'No stock items yet. Add your first lot to get started.'}
          </p>
        </div>
      ) : (
        <BulkLabelPrint>
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" className="label-select-all h-4 w-4 align-middle" aria-label="Select all for labels" />
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">SKU</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Code</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Count</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Fiber</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Lot</th>
                    <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Qty</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">UOM</th>
                    <th className="px-4 py-3 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lots.map((lot) => {
                    const typeName = Array.isArray(lot.item_types)
                      ? (lot.item_types[0] as { name: string } | undefined)?.name
                      : (lot.item_types as { name: string } | null)?.name
                    return (
                      <tr key={lot.id} className="hover:bg-secondary/50 transition-colors">
                        <td className="px-4 py-3">
                          <input type="checkbox" className="label-checkbox h-4 w-4 align-middle" value={lot.id} aria-label={`Select ${lot.name} for labels`} />
                        </td>
                        <td className="px-4 py-3 font-medium">{lot.name}</td>
                        <td className="px-4 py-3 font-mono text-xs tabular-nums">{lot.sku}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lot.code ?? '—'}</td>
                        <td className="px-4 py-3">{lot.count}</td>
                        <td className="px-4 py-3">{typeName ?? lot.type ?? '—'}</td>
                        <td className="px-4 py-3">{lot.fiber ?? '—'}</td>
                        <td className="px-4 py-3">{lot.lot ?? '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{lot.current_quantity}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lot.unit_of_measure ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/inventory/labels/print?ids=${lot.id}`}
                              target="_blank"
                              title="Print barcode label"
                              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                            >
                              <Barcode className="h-4 w-4" />
                            </Link>
                            <RoleGate allowedRoles={['owner']}>
                              <EditInventoryLotFormWrapper
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
                              <DeleteButton
                                description={`Delete stock item "${lot.name}"? This cannot be undone.`}
                                onDelete={deleteInventoryLotAction.bind(null, { id: lot.id })}
                              />
                            </RoleGate>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-2 px-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
            </span>
            {totalPages > 1 && (
              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <a
                    key={p}
                    href={`?page=${p}${filterCount ? `&count=${filterCount}` : ''}${filterType ? `&type=${filterType}` : ''}${filterFiber ? `&fiber=${filterFiber}` : ''}${filterLot ? `&lot=${filterLot}` : ''}`}
                    className={`px-2 py-1 rounded min-h-[44px] flex items-center ${p === page ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                  >
                    {p}
                  </a>
                ))}
              </div>
            )}
          </div>
        </BulkLabelPrint>
      )}
    </div>
  )
}
