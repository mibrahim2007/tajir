import { Suspense } from 'react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateLotForm } from './create-lot-form'
import { EditInventoryLotForm } from './edit-inventory-lot-form'
import { InventoryFilters } from './inventory-filters'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deleteInventoryLotAction } from '@/app/actions/delete-inventory-lot'

const PAGE_SIZE = 50

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  try {
  const { tenantId, role } = await requireAuth()
  const params = await searchParams

  const filterCount = typeof params.count === 'string' ? params.count : undefined
  const filterType = typeof params.type === 'string' ? params.type : undefined
  const filterFiber = typeof params.fiber === 'string' ? params.fiber : undefined
  const filterLot = typeof params.lot === 'string' ? params.lot : undefined
  const page = typeof params.page === 'string' ? Math.max(1, parseInt(params.page, 10) || 1) : 1

  const admin = createAdminClient()

  let dataQuery = admin
    .from('inventory_lots')
    .select('id, name, code, count, type, fiber, lot, current_quantity')
    .eq('tenant_id', tenantId)

  let countQuery = admin
    .from('inventory_lots')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  if (filterCount) { dataQuery = dataQuery.ilike('count', `%${filterCount}%`); countQuery = countQuery.ilike('count', `%${filterCount}%`) }
  if (filterType) { dataQuery = dataQuery.eq('type', filterType); countQuery = countQuery.eq('type', filterType) }
  if (filterFiber) { dataQuery = dataQuery.ilike('fiber', `%${filterFiber}%`); countQuery = countQuery.ilike('fiber', `%${filterFiber}%`) }
  if (filterLot) { dataQuery = dataQuery.ilike('lot', `%${filterLot}%`); countQuery = countQuery.ilike('lot', `%${filterLot}%`) }

  const [{ data: lots }, { count: totalRaw }] = await Promise.all([
    dataQuery.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    countQuery,
  ])

  const totalCount = totalRaw ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const hasFilters = filterCount || filterType || filterFiber || filterLot

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount} stock item{totalCount !== 1 ? 's' : ''}
            {hasFilters ? ' (filtered)' : ''}
          </p>
        </div>
        <CreateLotForm />
      </div>

      <Suspense>
        <InventoryFilters />
      </Suspense>

      {!lots || lots.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">
            {hasFilters
              ? 'No stock items match your filters'
              : 'No stock items yet. Add your first lot to get started.'}
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
                    <th className="text-right px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lots.map((lot) => (
                    <tr key={lot.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{lot.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{lot.code ?? '—'}</td>
                      <td className="px-4 py-3">{lot.count}</td>
                      <td className="px-4 py-3">{lot.type ?? '—'}</td>
                      <td className="px-4 py-3">{lot.fiber ?? '—'}</td>
                      <td className="px-4 py-3">{lot.lot ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{lot.current_quantity}</td>
                      <td className="px-4 py-3">
                        <RoleGate allowedRoles={['owner']}>
                          <div className="flex items-center gap-1">
                            <EditInventoryLotForm lot={{ id: lot.id, name: lot.name, code: lot.code, count: String(lot.count ?? ''), type: lot.type, fiber: lot.fiber, lot: lot.lot }} />
                            <DeleteButton
                              description={`Delete stock item "${lot.name}"? This cannot be undone.`}
                              onDelete={() => deleteInventoryLotAction({ id: lot.id })}
                            />
                          </div>
                        </RoleGate>
                      </td>
                    </tr>
                  ))}
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
        </>
      )}
    </div>
  )
  } catch (err) {
    console.error('INVENTORY_PAGE_ERROR', err instanceof Error ? err.message : String(err), err instanceof Error ? err.stack : '')
    throw err
  }
}
