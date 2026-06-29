import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PrintButton } from '@/components/print-button'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function LocationStockReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { tenantId } = await requireAuth()
  const params = await searchParams
  const filterLocation = typeof params.location === 'string' ? params.location : ''

  const admin = createAdminClient()

  const [{ data: rawStock }, { data: rawLocations }] = await Promise.all([
    admin
      .from('location_stock_summary')
      .select('stock_item_id, stock_item_name, yarn_count, location_id, location_name, quantity')
      .eq('tenant_id', tenantId)
      .gt('quantity', 0)
      .order('location_name')
      .order('stock_item_name'),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId).order('name'),
  ])

  const locations = rawLocations ?? []
  const allRows = (rawStock ?? []).map(r => ({
    stockItemId: r.stock_item_id,
    stockItemName: r.stock_item_name,
    yarnCount: r.yarn_count,
    locationId: r.location_id,
    locationName: r.location_name,
    quantity: parseFloat(String(r.quantity ?? '0')),
  }))

  const rows = filterLocation ? allRows.filter(r => r.locationId === filterLocation) : allRows

  // Group by location
  const grouped = new Map<string, { locationName: string; items: typeof rows }>()
  for (const row of rows) {
    if (!grouped.has(row.locationId)) {
      grouped.set(row.locationId, { locationName: row.locationName, items: [] })
    }
    grouped.get(row.locationId)!.items.push(row)
  }

  const grandTotal = rows.reduce((s, r) => s + r.quantity, 0)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6 print:mb-2">
        <div>
          <h1 className="text-2xl font-semibold">Location-wise Stock</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stock quantities per location, computed from purchases, sales, returns, and transfers.
          </p>
        </div>
        <PrintButton />
      </div>

      {/* Filter */}
      {locations.length > 0 && (
        <form method="GET" className="mb-6 flex gap-2 items-center print:hidden">
          <select
            name="location"
            defaultValue={filterLocation}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All locations</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <button type="submit" className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            Filter
          </button>
          {filterLocation && (
            <a href="/reports/location-stock" className="h-9 px-3 flex items-center text-sm text-muted-foreground hover:text-foreground">
              Clear
            </a>
          )}
        </form>
      )}

      {locations.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No locations have been set up yet.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No stock recorded at any location yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([locId, { locationName, items }]) => {
            const locTotal = items.reduce((s, r) => s + r.quantity, 0)
            return (
              <div key={locId} className="rounded-lg border overflow-hidden">
                <div className="bg-muted/50 border-b px-4 py-3 flex items-center justify-between">
                  <h2 className="font-semibold text-sm">{locationName}</h2>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Total: {locTotal.toLocaleString()} · {items.length} item{items.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/20 border-b">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Item</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Count</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map(item => (
                      <tr key={item.stockItemId} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 font-medium">{item.stockItemName}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{item.yarnCount}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">{item.quantity.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/10">
                    <tr>
                      <td colSpan={2} className="px-4 py-2.5 text-sm font-medium text-muted-foreground text-right">Subtotal</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{locTotal.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          })}

          {!filterLocation && grouped.size > 1 && (
            <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center justify-between">
              <span className="font-semibold text-sm">Grand Total</span>
              <span className="font-semibold tabular-nums">{grandTotal.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      <div className="hidden print:block mt-8 pt-4 border-t text-xs text-muted-foreground text-center">
        Generated {new Date().toLocaleDateString('en-PK', { dateStyle: 'long' })}
      </div>
    </div>
  )
}
