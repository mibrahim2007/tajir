import { Suspense } from 'react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { ExportButton } from '@/components/export-button'
import { PrintButton } from '@/components/print-button'
import { ReportFilters } from './report-filters'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function parseDate(val: unknown, fallback: string): string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val : fallback
}

export default async function PurchasesSalesReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { tenantId } = await requireAuth()
  const params = await searchParams

  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 7) + '-01'

  const from = parseDate(params.from, firstOfMonth)
  const to = parseDate(params.to, today)
  const type = typeof params.type === 'string' ? params.type : 'all'
  const location = typeof params.location === 'string' ? params.location : undefined

  const admin = createAdminClient()

  let purchaseQuery = admin.from('purchase_orders')
    .select('id, date, quantity, rate, currency_code, pkr_equivalent, supplier_id, stock_item_id, location_id')
    .eq('tenant_id', tenantId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })
  if (location) purchaseQuery = purchaseQuery.eq('location_id', location)

  let salesQuery = admin.from('sales_orders')
    .select('id, date, quantity, rate, currency_code, pkr_equivalent, customer_id, stock_item_id, location_id')
    .eq('tenant_id', tenantId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })
  if (location) salesQuery = salesQuery.eq('location_id', location)

  const [
    { data: rawPurchases },
    { data: rawSales },
    { data: rawSuppliers },
    { data: rawCustomers },
    { data: rawLots },
    { data: rawLocs },
  ] = await Promise.all([
    type !== 'sales' ? purchaseQuery : Promise.resolve({ data: [] }),
    type !== 'purchases' ? salesQuery : Promise.resolve({ data: [] }),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name, count, unit_of_measure').eq('tenant_id', tenantId),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId),
  ])

  const supplierMap = new Map((rawSuppliers ?? []).map((s) => [s.id, s.name]))
  const customerMap = new Map((rawCustomers ?? []).map((c) => [c.id, c.name]))
  const lotMap = new Map((rawLots ?? []).map((l) => [l.id, `${l.name} (${l.count})`]))
  const uomMap = new Map((rawLots ?? []).map((l) => [l.id, l.unit_of_measure ?? null]))
  const locationList = rawLocs ?? []
  const locationMap = new Map(locationList.map((l) => [l.id, l.name]))

  type Row = {
    id: string
    date: string
    kind: 'purchase' | 'sale'
    party: string
    item: string
    location: string
    quantity: number
    uom: string | null
    rate: number
    currencyCode: string
    pkrAmount: number
  }

  const purchaseRows: Row[] = (rawPurchases ?? []).map((p) => ({
    id: p.id,
    date: p.date,
    kind: 'purchase',
    party: supplierMap.get(p.supplier_id) ?? '—',
    item: lotMap.get(p.stock_item_id) ?? '—',
    location: p.location_id ? (locationMap.get(p.location_id) ?? '—') : '—',
    quantity: parseFloat(p.quantity),
    uom: uomMap.get(p.stock_item_id) ?? null,
    rate: parseFloat(p.rate),
    currencyCode: p.currency_code,
    pkrAmount: parseFloat(p.pkr_equivalent),
  }))

  const saleRows: Row[] = (rawSales ?? []).map((s) => ({
    id: s.id,
    date: s.date,
    kind: 'sale',
    party: customerMap.get(s.customer_id) ?? '—',
    item: lotMap.get(s.stock_item_id) ?? '—',
    location: s.location_id ? (locationMap.get(s.location_id) ?? '—') : '—',
    quantity: parseFloat(s.quantity),
    uom: uomMap.get(s.stock_item_id) ?? null,
    rate: parseFloat(s.rate),
    currencyCode: s.currency_code,
    pkrAmount: parseFloat(s.pkr_equivalent),
  }))

  const rows = [...purchaseRows, ...saleRows].sort((a, b) => b.date.localeCompare(a.date))

  const totalPurchases = purchaseRows.reduce((s, r) => s + r.pkrAmount, 0)
  const totalSales = saleRows.reduce((s, r) => s + r.pkrAmount, 0)
  const netProfit = totalSales - totalPurchases

  const exportParams = new URLSearchParams({ from, to, type, ...(location ? { location } : {}) })
  const exportHref = `/api/export/purchases-sales?${exportParams}`

  const dateLabel = `${formatPKTDate(from + 'T00:00:00')} – ${formatPKTDate(to + 'T00:00:00')}`

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 print:mb-2">
        <div>
          <h1 className="text-2xl font-semibold">Purchase &amp; Sales Report</h1>
          <p className="text-sm text-muted-foreground mt-1 print:block">{dateLabel}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton />
          <ExportButton href={exportHref} />
        </div>
      </div>

      {/* ── Filters ── */}
      <Suspense>
        <ReportFilters locations={locationList} />
      </Suspense>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {type !== 'sales' && (
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Purchases</p>
            <p className="text-xl font-semibold tabular-nums">{formatPKR(totalPurchases)}</p>
            <p className="text-xs text-muted-foreground mt-1">{purchaseRows.length} transaction{purchaseRows.length !== 1 ? 's' : ''}</p>
          </div>
        )}
        {type !== 'purchases' && (
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Sales</p>
            <p className="text-xl font-semibold tabular-nums">{formatPKR(totalSales)}</p>
            <p className="text-xs text-muted-foreground mt-1">{saleRows.length} transaction{saleRows.length !== 1 ? 's' : ''}</p>
          </div>
        )}
        {type === 'all' && (
          <div className={`rounded-lg border p-4 ${netProfit >= 0 ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'}`}>
            <p className="text-xs text-muted-foreground mb-1">Gross Profit</p>
            <p className={`text-xl font-semibold tabular-nums ${netProfit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              {netProfit >= 0 ? '' : '−'}{formatPKR(Math.abs(netProfit))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Sales − Purchases</p>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No transactions in this date range.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Party</th>
                  <th className="text-left px-4 py-3 font-medium">Item</th>
                  <th className="text-left px-4 py-3 font-medium">Location</th>
                  <th className="text-right px-4 py-3 font-medium">Qty</th>
                  <th className="text-right px-4 py-3 font-medium">Rate</th>
                  <th className="text-right px-4 py-3 font-medium">PKR Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatPKTDate(row.date + 'T00:00:00')}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.kind === 'purchase'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      }`}>
                        {row.kind === 'purchase' ? 'Purchase' : 'Sale'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{row.party}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.item}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.location}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.quantity.toLocaleString()}{row.uom && <span className="ml-1 text-muted-foreground text-xs">{row.uom}</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {row.currencyCode} {row.rate.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatPKR(row.pkrAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30">
                <tr>
                  <td colSpan={7} className="px-4 py-3 font-medium text-right">
                    {type === 'all' ? 'Total' : type === 'purchases' ? 'Total Purchases' : 'Total Sales'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    {formatPKR(type === 'purchases' ? totalPurchases : type === 'sales' ? totalSales : totalPurchases + totalSales)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Print-only footer ── */}
      <div className="hidden print:block mt-8 pt-4 border-t text-xs text-muted-foreground text-center">
        Generated {formatPKTDate(new Date().toISOString())} · {dateLabel}
      </div>
    </div>
  )
}
