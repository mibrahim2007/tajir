import { Suspense } from 'react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { InventoryFilters } from '@/app/(app)/inventory/inventory-filters'
import { ExportButton } from '@/components/export-button'

const PAGE_SIZE = 50

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function StockSummaryPage({ searchParams }: { searchParams: SearchParams }) {
  const { tenantId } = await requireAuth()
  const params = await searchParams

  const filterCount = typeof params.count === 'string' ? params.count : undefined
  const filterType  = typeof params.type  === 'string' ? params.type  : undefined
  const filterFiber = typeof params.fiber === 'string' ? params.fiber : undefined
  const filterLot   = typeof params.lot   === 'string' ? params.lot   : undefined
  const page        = typeof params.page  === 'string' ? Math.max(1, parseInt(params.page, 10) || 1) : 1

  const admin = createAdminClient()

  let query = admin
    .from('inventory_lots')
    .select('id, name, code, count, type, fiber, lot, current_quantity, default_supplier_id, item_type_id, item_types(name)', { count: 'exact' })
    .eq('tenant_id', tenantId)

  if (filterCount) query = query.ilike('count', `%${filterCount}%`)
  if (filterType)  query = query.eq('item_type_id', filterType)
  if (filterFiber) query = query.ilike('fiber', `%${filterFiber}%`)
  if (filterLot)   query = query.ilike('lot',   `%${filterLot}%`)

  const [{ data: rawLots, count: total }, { data: rawSuppliers }, { data: itemTypes }] = await Promise.all([
    query.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId),
    admin.from('item_types').select('id, name').eq('tenant_id', tenantId).order('name'),
  ])

  const lots = rawLots ?? []
  const supplierMap = new Map((rawSuppliers ?? []).map((s) => [s.id, s.name]))
  const safeItemTypes = itemTypes ?? []
  const totalCount = total ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const hasFilters = filterCount || filterType || filterFiber || filterLot

  const exportParams = new URLSearchParams()
  if (filterCount) exportParams.set('count', filterCount)
  if (filterType)  exportParams.set('type', filterType)
  if (filterFiber) exportParams.set('fiber', filterFiber)
  if (filterLot)   exportParams.set('lot', filterLot)
  const exportHref = `/api/export/stock-summary${exportParams.size > 0 ? `?${exportParams}` : ''}`

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Stock Summary</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount} item{totalCount !== 1 ? 's' : ''}{hasFilters ? ' (filtered)' : ''}
          </p>
        </div>
        <ExportButton href={exportHref} />
      </div>

      <Suspense>
        <InventoryFilters itemTypes={safeItemTypes} />
      </Suspense>

      {lots.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">
            {hasFilters ? 'No stock items match your filters' : 'No stock items yet.'}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Code</th>
                    <th className="text-left px-4 py-3 font-medium">Count</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Fiber</th>
                    <th className="text-left px-4 py-3 font-medium">Lot</th>
                    <th className="text-left px-4 py-3 font-medium">Supplier</th>
                    <th className="text-right px-4 py-3 font-medium">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lots.map((lot) => {
                    const typeName = Array.isArray(lot.item_types)
                      ? (lot.item_types[0] as { name: string } | undefined)?.name
                      : (lot.item_types as { name: string } | null)?.name
                    return (
                      <tr key={lot.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{lot.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lot.code ?? '—'}</td>
                        <td className="px-4 py-3">{lot.count}</td>
                        <td className="px-4 py-3">{typeName ?? lot.type ?? '—'}</td>
                        <td className="px-4 py-3">{lot.fiber ?? '—'}</td>
                        <td className="px-4 py-3">{lot.lot ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lot.default_supplier_id ? (supplierMap.get(lot.default_supplier_id) ?? '—') : '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{parseFloat(String(lot.current_quantity)).toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-2 px-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}</span>
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
        </>
      )}
    </div>
  )
}
