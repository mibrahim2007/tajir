import Link from 'next/link'
import { Suspense } from 'react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenant } from '@/lib/auth/get-tenant'
import { formatPKTDate } from '@/lib/utils/dates'
import { PrintButton } from '@/components/print-button'
import { ItemPLFilters } from './item-pl-filters'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function parseDate(val: unknown, fallback: string): string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val : fallback
}

export default async function ItemProfitLossPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const itemId = typeof params.item === 'string' ? params.item : undefined
  const today        = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 7) + '-01'
  const fromDate = parseDate(params.from, firstOfMonth)
  const toDate   = parseDate(params.to,   today)

  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const { data: rawLots } = await admin
    .from('inventory_lots').select('id, name, unit_of_measure').eq('tenant_id', tenantId).order('name')
  const lots = rawLots ?? []
  const lotMap = new Map(lots.map(l => [l.id, l.name]))

  if (!itemId) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <Link href="/reports" className="text-sm text-muted-foreground hover:text-foreground">← Reports</Link>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1">Item Profit & Loss</h1>
          <p className="text-sm text-muted-foreground mt-1">Revenue, cost, and gross profit for a single stock item over a date range.</p>
        </div>
        <Suspense>
          <ItemPLFilters lots={lots} />
        </Suspense>
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm mt-4">
          <p className="text-muted-foreground text-sm">Select a stock item to view its profit & loss.</p>
        </div>
      </div>
    )
  }

  const itemName = lotMap.get(itemId) ?? itemId
  const uom = lots.find(l => l.id === itemId)?.unit_of_measure ?? null

  const [
    { data: rawSuppliers },
    { data: rawCustomers },
    { data: purchases },
    { data: sales },
    { data: purchaseReturns },
    { data: saleReturns },
    tenant,
  ] = await Promise.all([
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    admin.from('purchase_orders')
      .select('id, date, created_at, quantity, rate, currency_code, exchange_rate, pkr_equivalent, supplier_id')
      .eq('tenant_id', tenantId).eq('stock_item_id', itemId)
      .gte('date', fromDate).lte('date', toDate),
    admin.from('sales_orders')
      .select('id, date, created_at, quantity, rate, currency_code, exchange_rate, pkr_equivalent, customer_id')
      .eq('tenant_id', tenantId).eq('stock_item_id', itemId)
      .gte('date', fromDate).lte('date', toDate),
    admin.from('purchase_returns')
      .select('id, date, created_at, quantity, rate, currency_code, exchange_rate, pkr_equivalent, supplier_id')
      .eq('tenant_id', tenantId).eq('stock_item_id', itemId)
      .gte('date', fromDate).lte('date', toDate),
    admin.from('sale_returns')
      .select('id, date, created_at, quantity, rate, currency_code, exchange_rate, pkr_equivalent, customer_id')
      .eq('tenant_id', tenantId).eq('stock_item_id', itemId)
      .gte('date', fromDate).lte('date', toDate),
    getTenant(tenantId),
  ])

  const supplierMap = new Map((rawSuppliers ?? []).map(s => [s.id, s.name]))
  const customerMap = new Map((rawCustomers ?? []).map(c => [c.id, c.name]))
  const parse = (v: unknown) => parseFloat(String(v ?? 0)) || 0

  /* ── Aggregates ── */
  const grossSales      = (sales ?? []).reduce((s, r) => s + parse(r.pkr_equivalent), 0)
  const salesReturnAmt  = (saleReturns ?? []).reduce((s, r) => s + parse(r.pkr_equivalent), 0)
  const netRevenue      = grossSales - salesReturnAmt

  const grossPurchases  = (purchases ?? []).reduce((s, r) => s + parse(r.pkr_equivalent), 0)
  const purchReturnAmt  = (purchaseReturns ?? []).reduce((s, r) => s + parse(r.pkr_equivalent), 0)
  const netCost         = grossPurchases - purchReturnAmt

  const grossProfit     = netRevenue - netCost
  const marginPct       = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0

  const totalSaleQty    = (sales ?? []).reduce((s, r) => s + parse(r.quantity), 0)
  const totalPurchQty   = (purchases ?? []).reduce((s, r) => s + parse(r.quantity), 0)

  /* ── Transaction rows merged and sorted ── */
  type TxRow = {
    sortKey: string; date: string
    type: 'Purchase' | 'Sale' | 'Purchase Return' | 'Sale Return'
    party: string; qty: number; pkrRate: number; amount: number; isCredit: boolean
  }

  const txRows: TxRow[] = [
    ...(purchases ?? []).map(r => ({
      sortKey: r.date + '|' + (r.created_at ?? '') + '|' + r.id,
      date: r.date as string, type: 'Purchase' as const,
      party: supplierMap.get(r.supplier_id as string) ?? '—',
      qty: parse(r.quantity),
      pkrRate: parse(r.currency_code === 'USD' ? parse(r.rate) * parse(r.exchange_rate) : r.rate),
      amount: parse(r.pkr_equivalent), isCredit: false,
    })),
    ...(sales ?? []).map(r => ({
      sortKey: r.date + '|' + (r.created_at ?? '') + '|' + r.id,
      date: r.date as string, type: 'Sale' as const,
      party: customerMap.get(r.customer_id as string) ?? '—',
      qty: parse(r.quantity),
      pkrRate: parse(r.currency_code === 'USD' ? parse(r.rate) * parse(r.exchange_rate) : r.rate),
      amount: parse(r.pkr_equivalent), isCredit: false,
    })),
    ...(purchaseReturns ?? []).map(r => ({
      sortKey: r.date + '|' + (r.created_at ?? '') + '|' + r.id,
      date: r.date as string, type: 'Purchase Return' as const,
      party: supplierMap.get(r.supplier_id as string) ?? '—',
      qty: parse(r.quantity),
      pkrRate: parse(r.currency_code === 'USD' ? parse(r.rate) * parse(r.exchange_rate) : r.rate),
      amount: parse(r.pkr_equivalent), isCredit: true,
    })),
    ...(saleReturns ?? []).map(r => ({
      sortKey: r.date + '|' + (r.created_at ?? '') + '|' + r.id,
      date: r.date as string, type: 'Sale Return' as const,
      party: customerMap.get(r.customer_id as string) ?? '—',
      qty: parse(r.quantity),
      pkrRate: parse(r.currency_code === 'USD' ? parse(r.rate) * parse(r.exchange_rate) : r.rate),
      amount: parse(r.pkr_equivalent), isCredit: true,
    })),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  const fmtPKR = (n: number) => `Rs ${n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtQty = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 3 })
  const printDate = new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })

  const TYPE_COLOR: Record<string, string> = {
    'Purchase':        'text-blue-600 dark:text-blue-400',
    'Sale':            'text-emerald-600 dark:text-emerald-400',
    'Purchase Return': 'text-orange-600 dark:text-orange-400',
    'Sale Return':     'text-purple-600 dark:text-purple-400',
  }
  const TYPE_BG: Record<string, string> = {
    'Purchase':        'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
    'Sale':            'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
    'Purchase Return': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800',
    'Sale Return':     'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800',
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Toolbar */}
      <div className="print:hidden flex items-center gap-3 px-6 py-4 border-b sticky top-0 bg-background z-10">
        <div className="flex-1">
          <Link href="/reports" className="text-xs text-muted-foreground hover:text-foreground">← Reports</Link>
          <h1 className="text-xl font-extrabold tracking-tight mt-0.5">Item Profit & Loss</h1>
        </div>
        <PrintButton />
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 print:px-0 print:py-0 print:max-w-none">

        {/* Print header */}
        <div className="hidden print:block text-center mb-6 pb-4 border-b-2 border-black">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">{tenant.name}</p>
          <h1 className="text-2xl font-bold">Item Profit & Loss</h1>
          <p className="text-sm font-semibold mt-1">{itemName}</p>
          <p className="text-xs text-gray-500 mt-1">{fromDate} to {toDate}</p>
        </div>

        {/* Filters */}
        <Suspense>
          <div className="print:hidden">
            <ItemPLFilters lots={lots} />
          </div>
        </Suspense>

        {/* Item + period label (screen) */}
        <div className="print:hidden mb-5">
          <p className="text-lg font-bold text-foreground">{itemName}</p>
          <p className="text-sm text-muted-foreground">{fromDate} → {toDate}</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Net Revenue</p>
            <p className="text-xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtPKR(netRevenue)}</p>
            {salesReturnAmt > 0 && <p className="text-[10px] text-muted-foreground mt-1">Returns: {fmtPKR(salesReturnAmt)}</p>}
          </div>
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Net Cost</p>
            <p className="text-xl font-extrabold tabular-nums text-blue-600 dark:text-blue-400">{fmtPKR(netCost)}</p>
            {purchReturnAmt > 0 && <p className="text-[10px] text-muted-foreground mt-1">Returns: {fmtPKR(purchReturnAmt)}</p>}
          </div>
          <div className={`bg-card border rounded-xl p-4 shadow-sm ${grossProfit >= 0 ? 'border-emerald-200 dark:border-emerald-800' : 'border-destructive/30'}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Gross Profit</p>
            <p className={`text-xl font-extrabold tabular-nums ${grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
              {fmtPKR(grossProfit)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Gross Margin</p>
            <p className={`text-xl font-extrabold tabular-nums ${marginPct >= 0 ? 'text-foreground' : 'text-destructive'}`}>
              {marginPct.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Sold {fmtQty(totalSaleQty)}{uom ? ` ${uom}` : ''} · Bought {fmtQty(totalPurchQty)}{uom ? ` ${uom}` : ''}
            </p>
          </div>
        </div>

        {/* Breakdown table */}
        {txRows.length === 0 ? (
          <div className="bg-card rounded-2xl border border-dashed py-12 text-center shadow-sm">
            <p className="text-muted-foreground text-sm">No transactions for this item in the selected date range.</p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 print:bg-gray-100 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">#</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Party</th>
                    <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Qty{uom && <span className="ml-1 font-normal normal-case">({uom})</span>}</th>
                    <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Rate (PKR)</th>
                    <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Amount (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {txRows.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(row.date))}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${TYPE_BG[row.type]}`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.party}</td>
                      <td className={`px-4 py-3 text-right tabular-nums font-medium ${TYPE_COLOR[row.type]}`}>{fmtQty(row.qty)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {row.pkrRate > 0 ? row.pkrRate.toLocaleString('en-PK', { maximumFractionDigits: 2 }) : '—'}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${row.isCredit ? 'text-muted-foreground line-through' : ''}`}>
                        {fmtPKR(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Summary footer */}
                <tfoot className="border-t-2 bg-muted/30 print:bg-gray-100 text-sm">
                  <tr className="border-b border-border/50">
                    <td colSpan={5} className="px-4 py-2 text-right text-xs text-muted-foreground font-medium">Gross Sales</td>
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{fmtPKR(grossSales)}</td>
                  </tr>
                  {salesReturnAmt > 0 && (
                    <tr className="border-b border-border/50">
                      <td colSpan={5} className="px-4 py-2 text-right text-xs text-muted-foreground font-medium">Less: Sale Returns</td>
                      <td className="px-4 py-2" />
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">({fmtPKR(salesReturnAmt)})</td>
                    </tr>
                  )}
                  <tr className="border-b border-border/50">
                    <td colSpan={5} className="px-4 py-2 text-right text-xs text-muted-foreground font-medium">Net Revenue</td>
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">{fmtPKR(netRevenue)}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td colSpan={5} className="px-4 py-2 text-right text-xs text-muted-foreground font-medium">Gross Purchases</td>
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">{fmtPKR(grossPurchases)}</td>
                  </tr>
                  {purchReturnAmt > 0 && (
                    <tr className="border-b border-border/50">
                      <td colSpan={5} className="px-4 py-2 text-right text-xs text-muted-foreground font-medium">Less: Purchase Returns</td>
                      <td className="px-4 py-2" />
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">({fmtPKR(purchReturnAmt)})</td>
                    </tr>
                  )}
                  <tr className="border-b border-border/50">
                    <td colSpan={5} className="px-4 py-2 text-right text-xs text-muted-foreground font-medium">Net Cost</td>
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2 text-right tabular-nums font-bold text-blue-600 dark:text-blue-400">{fmtPKR(netCost)}</td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right text-xs font-extrabold uppercase tracking-wide">
                      Gross Profit <span className="font-normal normal-case text-muted-foreground">({marginPct.toFixed(1)}% margin)</span>
                    </td>
                    <td className="px-4 py-3" />
                    <td className={`px-4 py-3 text-right tabular-nums font-extrabold text-base ${grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                      {fmtPKR(grossProfit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Print footer */}
        <div className="hidden print:flex justify-between mt-8 pt-4 border-t border-gray-300 text-xs text-gray-400">
          <span>Tajir · {tenant.name}</span>
          <span>Printed: {printDate}</span>
        </div>
      </div>
    </div>
  )
}
