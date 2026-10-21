import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PrintButton } from '@/components/print-button'
import { loadItemProfiles, profileOf } from '@/lib/inventory/item-profiles'
import { loadStockPositions } from '@/lib/inventory/stock-position'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 3 })

// On-hand stock per location × item × grade × lot, from the stock_position
// view (migration 0072). Quantities are in each item's stock unit; packs are
// the cartons / bags recorded on the lines.
export default async function StockPositionReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { tenantId } = await requireAuth()
  const params = await searchParams
  const filterLocation = typeof params.location === 'string' ? params.location : ''
  const filterType = typeof params.type === 'string' ? params.type : ''

  const admin = createAdminClient()

  const [positions, profiles, { data: rawLocations }, { data: rawLots }, { data: rawTypes }, { data: rawGrades }] = await Promise.all([
    loadStockPositions(admin, tenantId, { locationId: filterLocation || null }),
    loadItemProfiles(admin, tenantId),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name, count, unit_of_measure, item_type_id').eq('tenant_id', tenantId),
    admin.from('item_types').select('id, name, parent_id').eq('tenant_id', tenantId).order('name'),
    admin.from('grades').select('id, name').eq('tenant_id', tenantId),
  ])

  const locations = rawLocations ?? []
  const locationNames = new Map(locations.map((l) => [l.id, l.name]))
  const lots = new Map((rawLots ?? []).map((l) => [l.id, l]))
  const gradeNames = new Map((rawGrades ?? []).map((g) => [g.id, g.name]))
  const types = rawTypes ?? []
  const topTypes = types.filter((t) => !t.parent_id)

  // A top-level type filter takes in its sub-types too.
  const typeIds = filterType
    ? new Set([filterType, ...types.filter((t) => t.parent_id === filterType).map((t) => t.id)])
    : null

  const rows = positions
    .filter((p) => p.quantity !== 0 || p.packs !== 0)
    .filter((p) => !typeIds || typeIds.has(lots.get(p.stockItemId)?.item_type_id ?? ''))
    .map((p) => {
      const lot = lots.get(p.stockItemId)
      const profile = profileOf(profiles, p.stockItemId)
      return {
        ...p,
        itemName:     lot?.name ?? '—',
        count:        lot?.count == null ? '' : String(lot.count),
        locationName: locationNames.get(p.locationId) ?? '—',
        gradeName:    p.gradeId ? gradeNames.get(p.gradeId) ?? '—' : null,
        stockUnit:    profile.stockUnit ?? lot?.unit_of_measure ?? null,
        packUnit:     profile.packUnit,
      }
    })
    .sort((a, b) =>
      a.locationName.localeCompare(b.locationName)
      || a.itemName.localeCompare(b.itemName)
      || (a.gradeName ?? '').localeCompare(b.gradeName ?? '')
      || (a.lotNo ?? '').localeCompare(b.lotNo ?? ''))

  const grouped = new Map<string, { locationName: string; items: typeof rows }>()
  for (const row of rows) {
    if (!grouped.has(row.locationId)) grouped.set(row.locationId, { locationName: row.locationName, items: [] })
    grouped.get(row.locationId)!.items.push(row)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6 print:mb-2">
        <div>
          <h1 className="text-2xl font-semibold">Stock by Grade &amp; Lot</h1>
          <p className="text-sm text-muted-foreground mt-1">
            On-hand stock per location, item, grade and lot, in the item&apos;s stock unit and in cartons / bags.
          </p>
        </div>
        <PrintButton />
      </div>

      <form method="GET" className="mb-6 flex flex-wrap gap-2 items-center print:hidden">
        <select
          name="location"
          defaultValue={filterLocation}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select
          name="type"
          defaultValue={filterType}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All item types</option>
          {topTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button type="submit" className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          Filter
        </button>
        {(filterLocation || filterType) && (
          <a href="/reports/stock-position" className="h-9 px-3 flex items-center text-sm text-muted-foreground hover:text-foreground">
            Clear
          </a>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No stock recorded for this selection.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([locId, { locationName, items }]) => {
            const locPacks = items.reduce((s, r) => s + r.packs, 0)
            return (
              <div key={locId} className="rounded-lg border overflow-hidden">
                <div className="bg-muted/50 border-b px-4 py-3 flex items-center justify-between">
                  <h2 className="font-semibold text-sm">{locationName}</h2>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {items.length} line{items.length !== 1 ? 's' : ''}{locPacks ? ` · ${fmt(locPacks)} packs` : ''}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/20 border-b">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Item</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Grade</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Lot</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Packs</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((r, i) => (
                        <tr key={`${r.stockItemId}-${r.gradeId ?? ''}-${r.lotNo ?? ''}-${i}`} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 font-medium">
                            {r.itemName}
                            {r.count && <span className="ml-1.5 text-xs text-muted-foreground font-normal">{r.count}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{r.gradeName ?? '—'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{r.lotNo ?? '—'}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {r.packs ? <>{fmt(r.packs)}<span className="ml-1 text-muted-foreground text-xs">{r.packUnit ?? 'ctn'}</span></> : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                            {fmt(r.quantity)}
                            {r.stockUnit && <span className="ml-1 text-muted-foreground text-xs">{r.stockUnit}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
