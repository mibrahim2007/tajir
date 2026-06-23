import Link from 'next/link'
import { Suspense } from 'react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenant } from '@/lib/auth/get-tenant'
import { formatPKTDate } from '@/lib/utils/dates'
import { PrintButton } from '@/components/print-button'
import { CustomerPLFilters } from './filters'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function parseDate(val: unknown, fallback: string): string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val : fallback
}

export default async function CustomerProfitLossPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const today        = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 7) + '-01'
  const fromDate     = parseDate(params.from, firstOfMonth)
  const toDate       = parseDate(params.to,   today)
  const customerId   = typeof params.customer === 'string' && params.customer ? params.customer : null

  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [
    { data: rawCustomers },
    { data: rawSales },
    { data: rawReturns },
    { data: rawPurchases },
    { data: rawLots },
    tenant,
  ] = await Promise.all([
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('sales_orders')
      .select('id, date, created_at, customer_id, stock_item_id, quantity, rate, currency_code, exchange_rate, pkr_equivalent')
      .eq('tenant_id', tenantId)
      .gte('date', fromDate).lte('date', toDate),
    admin.from('sale_returns')
      .select('id, date, created_at, customer_id, stock_item_id, quantity, rate, currency_code, exchange_rate, pkr_equivalent')
      .eq('tenant_id', tenantId)
      .gte('date', fromDate).lte('date', toDate),
    // All purchases (all time) to get latest rate per item
    admin.from('purchase_orders')
      .select('stock_item_id, rate, currency_code, exchange_rate, date, created_at')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
    getTenant(tenantId),
  ])

  const parse = (v: unknown) => parseFloat(String(v ?? 0)) || 0

  // Map: stock_item_id → latest purchase PKR rate
  const latestPurchRate = new Map<string, number>()
  for (const p of (rawPurchases ?? [])) {
    const id = p.stock_item_id as string
    if (!latestPurchRate.has(id)) {
      const r  = parse(p.rate)
      const er = parse(p.exchange_rate ?? 1)
      latestPurchRate.set(id, (p.currency_code as string) === 'USD' ? r * er : r)
    }
  }

  const customerMap = new Map((rawCustomers ?? []).map(c => [c.id, c.name as string]))
  const lotMap      = new Map((rawLots ?? []).map(l => [l.id, l.name as string]))

  // Filter to customer if selected
  const sales   = (rawSales   ?? []).filter(r => !customerId || r.customer_id === customerId)
  const returns = (rawReturns ?? []).filter(r => !customerId || r.customer_id === customerId)

  const printDate = new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })
  const fmtPKR = (n: number) => `Rs ${n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtQty = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 3 })

  /* ── DETAIL view: single customer ── */
  if (customerId) {
    const customerName = customerMap.get(customerId) ?? customerId

    type DetailRow = {
      sortKey: string; date: string; itemName: string
      qty: number; saleRate: number; purchRate: number
      revenue: number; cogs: number; profit: number
      isReturn: boolean
    }

    const rows: DetailRow[] = [
      ...sales.map(r => {
        const qty      = parse(r.quantity)
        const revenue  = parse(r.pkr_equivalent)
        const saleRate = parse(r.currency_code === 'USD' ? parse(r.rate) * parse(r.exchange_rate) : r.rate)
        const purchRate = latestPurchRate.get(r.stock_item_id as string) ?? 0
        const cogs     = qty * purchRate
        return {
          sortKey: (r.date as string) + '|' + (r.created_at ?? '') + '|' + r.id,
          date: r.date as string,
          itemName: lotMap.get(r.stock_item_id as string) ?? '—',
          qty, saleRate, purchRate, revenue, cogs,
          profit: revenue - cogs, isReturn: false,
        }
      }),
      ...returns.map(r => {
        const qty      = parse(r.quantity)
        const revenue  = parse(r.pkr_equivalent)
        const saleRate = parse(r.currency_code === 'USD' ? parse(r.rate) * parse(r.exchange_rate) : r.rate)
        const purchRate = latestPurchRate.get(r.stock_item_id as string) ?? 0
        const cogs     = qty * purchRate
        return {
          sortKey: (r.date as string) + '|' + (r.created_at ?? '') + '|' + r.id,
          date: r.date as string,
          itemName: lotMap.get(r.stock_item_id as string) ?? '—',
          qty, saleRate, purchRate, revenue, cogs,
          profit: -(revenue - cogs), isReturn: true,
        }
      }),
    ].sort((a, b) => a.sortKey.localeCompare(b.sortKey))

    const totalRevenue = sales.reduce((s, r) => s + parse(r.pkr_equivalent), 0)
    const totalReturns = returns.reduce((s, r) => s + parse(r.pkr_equivalent), 0)
    const netRevenue   = totalRevenue - totalReturns
    const totalCOGS    = rows.reduce((s, r) => s + (r.isReturn ? -r.cogs : r.cogs), 0)
    const grossProfit  = netRevenue - totalCOGS
    const marginPct    = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0

    return (
      <div className="min-h-screen bg-background">
        <div className="print:hidden flex items-center gap-3 px-6 py-4 border-b sticky top-0 bg-background z-10">
          <div className="flex-1">
            <Link href="/reports" className="text-xs text-muted-foreground hover:text-foreground">← Reports</Link>
            <h1 className="text-xl font-extrabold tracking-tight mt-0.5">Customer P&L</h1>
          </div>
          <PrintButton />
        </div>

        <div className="max-w-5xl mx-auto px-6 py-6 print:px-0 print:py-0 print:max-w-none">

          <div className="hidden print:block text-center mb-6 pb-4 border-b-2 border-black">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">{tenant.name}</p>
            <h1 className="text-2xl font-bold">Customer Profit & Loss</h1>
            <p className="text-sm font-semibold mt-1">{customerName}</p>
            <p className="text-xs text-gray-500 mt-1">{fromDate} to {toDate}</p>
          </div>

          <Suspense>
            <div className="print:hidden">
              <CustomerPLFilters customers={rawCustomers ?? []} />
            </div>
          </Suspense>

          <div className="print:hidden mb-5">
            <p className="text-lg font-bold">{customerName}</p>
            <p className="text-sm text-muted-foreground">{fromDate} → {toDate}</p>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Net Revenue</p>
              <p className="text-xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtPKR(netRevenue)}</p>
              {totalReturns > 0 && <p className="text-[10px] text-muted-foreground mt-1">Returns: {fmtPKR(totalReturns)}</p>}
            </div>
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Est. COGS</p>
              <p className="text-xl font-extrabold tabular-nums text-blue-600 dark:text-blue-400">{fmtPKR(totalCOGS)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Based on last purchase rate</p>
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
              <p className="text-[10px] text-muted-foreground mt-1">{rows.filter(r => !r.isReturn).length} invoices</p>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="bg-card rounded-2xl border border-dashed py-12 text-center shadow-sm">
              <p className="text-muted-foreground text-sm">No sales to this customer in the selected date range.</p>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 print:bg-gray-100 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">#</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Item</th>
                      <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Qty</th>
                      <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sale Rate</th>
                      <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Purch. Rate</th>
                      <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-emerald-600">Revenue</th>
                      <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-blue-600">COGS</th>
                      <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((row, i) => (
                      <tr key={i} className={`hover:bg-muted/30 transition-colors ${row.isReturn ? 'opacity-70' : ''}`}>
                        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(row.date))}</td>
                        <td className="px-4 py-3 font-medium">
                          {row.itemName}
                          {row.isReturn && <span className="ml-2 text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 px-1.5 py-0.5 rounded-full">Return</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtQty(row.qty)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {row.saleRate > 0 ? row.saleRate.toLocaleString('en-PK', { maximumFractionDigits: 2 }) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {row.purchRate > 0 ? row.purchRate.toLocaleString('en-PK', { maximumFractionDigits: 2 }) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                          {row.isReturn ? <span className="text-muted-foreground">({fmtPKR(row.revenue)})</span> : fmtPKR(row.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-blue-600 dark:text-blue-400">
                          {row.cogs > 0 ? (row.isReturn ? <span className="text-muted-foreground">({fmtPKR(row.cogs)})</span> : fmtPKR(row.cogs)) : '—'}
                        </td>
                        <td className={`px-4 py-3 text-right tabular-nums font-semibold ${row.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                          {row.cogs > 0 ? fmtPKR(row.profit) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 bg-muted/30 print:bg-gray-100 text-sm">
                    <tr className="border-b border-border/50">
                      <td colSpan={6} className="px-4 py-2 text-right text-xs text-muted-foreground font-medium">Net Revenue</td>
                      <td className="px-4 py-2 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">{fmtPKR(netRevenue)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-bold text-blue-600 dark:text-blue-400">{fmtPKR(totalCOGS)}</td>
                      <td className={`px-4 py-2 text-right tabular-nums font-extrabold ${grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                        {fmtPKR(grossProfit)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={8} className="px-4 py-2 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Gross Margin
                      </td>
                      <td className={`px-4 py-2 text-right font-extrabold ${marginPct >= 0 ? '' : 'text-destructive'}`}>
                        {marginPct.toFixed(1)}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          <div className="hidden print:flex justify-between mt-8 pt-4 border-t border-gray-300 text-xs text-gray-400">
            <span>Tajir · {tenant.name}</span>
            <span>Printed: {printDate}</span>
          </div>
        </div>
      </div>
    )
  }

  /* ── SUMMARY view: all customers ── */
  type CustomerSummary = {
    id: string; name: string
    revenue: number; returnsAmt: number; netRevenue: number
    cogs: number; grossProfit: number; marginPct: number
    invoiceCount: number
  }

  const summaryMap = new Map<string, CustomerSummary>()
  const ensureCustomer = (cid: string) => {
    if (!summaryMap.has(cid)) {
      summaryMap.set(cid, {
        id: cid, name: customerMap.get(cid) ?? cid,
        revenue: 0, returnsAmt: 0, netRevenue: 0,
        cogs: 0, grossProfit: 0, marginPct: 0, invoiceCount: 0,
      })
    }
    return summaryMap.get(cid)!
  }

  for (const s of (rawSales ?? [])) {
    const row = ensureCustomer(s.customer_id as string)
    const qty  = parse(s.quantity)
    const pRate = latestPurchRate.get(s.stock_item_id as string) ?? 0
    row.revenue     += parse(s.pkr_equivalent)
    row.cogs        += qty * pRate
    row.invoiceCount++
  }
  for (const r of (rawReturns ?? [])) {
    const row = ensureCustomer(r.customer_id as string)
    const qty  = parse(r.quantity)
    const pRate = latestPurchRate.get(r.stock_item_id as string) ?? 0
    row.returnsAmt += parse(r.pkr_equivalent)
    row.cogs       -= qty * pRate
  }

  const summaries = [...summaryMap.values()].map(row => {
    row.netRevenue  = row.revenue - row.returnsAmt
    row.grossProfit = row.netRevenue - row.cogs
    row.marginPct   = row.netRevenue > 0 ? (row.grossProfit / row.netRevenue) * 100 : 0
    return row
  }).sort((a, b) => b.netRevenue - a.netRevenue)

  const totRevenue = summaries.reduce((s, r) => s + r.netRevenue, 0)
  const totCOGS    = summaries.reduce((s, r) => s + r.cogs, 0)
  const totProfit  = summaries.reduce((s, r) => s + r.grossProfit, 0)
  const totMargin  = totRevenue > 0 ? (totProfit / totRevenue) * 100 : 0

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden flex items-center gap-3 px-6 py-4 border-b sticky top-0 bg-background z-10">
        <div className="flex-1">
          <Link href="/reports" className="text-xs text-muted-foreground hover:text-foreground">← Reports</Link>
          <h1 className="text-xl font-extrabold tracking-tight mt-0.5">Customer Profit & Loss</h1>
        </div>
        <PrintButton />
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 print:px-0 print:py-0 print:max-w-none">

        <div className="hidden print:block text-center mb-6 pb-4 border-b-2 border-black">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">{tenant.name}</p>
          <h1 className="text-2xl font-bold">Customer Profit & Loss — All Customers</h1>
          <p className="text-xs text-gray-500 mt-1">{fromDate} to {toDate}</p>
        </div>

        <Suspense>
          <div className="print:hidden">
            <CustomerPLFilters customers={rawCustomers ?? []} />
          </div>
        </Suspense>

        {/* Totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Total Revenue</p>
            <p className="text-xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtPKR(totRevenue)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Total COGS</p>
            <p className="text-xl font-extrabold tabular-nums text-blue-600 dark:text-blue-400">{fmtPKR(totCOGS)}</p>
          </div>
          <div className={`bg-card border rounded-xl p-4 shadow-sm ${totProfit >= 0 ? 'border-emerald-200 dark:border-emerald-800' : 'border-destructive/30'}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Total Profit</p>
            <p className={`text-xl font-extrabold tabular-nums ${totProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
              {fmtPKR(totProfit)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Avg Margin</p>
            <p className="text-xl font-extrabold tabular-nums">{totMargin.toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground mt-1">{summaries.length} customers</p>
          </div>
        </div>

        {summaries.length === 0 ? (
          <div className="bg-card rounded-2xl border border-dashed py-12 text-center shadow-sm">
            <p className="text-muted-foreground text-sm">No sales in the selected date range.</p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 print:bg-gray-100 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">#</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Customer</th>
                    <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Invoices</th>
                    <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-emerald-600">Net Revenue</th>
                    <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-blue-600">COGS</th>
                    <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Gross Profit</th>
                    <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {summaries.map((row, i) => (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => {}} /* handled via Link below */>
                      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold">
                        <Link
                          href={`/reports/customer-profit-loss?customer=${row.id}&from=${fromDate}&to=${toDate}`}
                          className="hover:text-primary hover:underline transition-colors"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{row.invoiceCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{fmtPKR(row.netRevenue)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-blue-600 dark:text-blue-400">{fmtPKR(row.cogs)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${row.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                        {fmtPKR(row.grossProfit)}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${row.marginPct >= 0 ? '' : 'text-destructive'}`}>
                        {row.marginPct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 bg-muted/30 print:bg-gray-100">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">{fmtPKR(totRevenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-blue-600 dark:text-blue-400">{fmtPKR(totCOGS)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-extrabold ${totProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>{fmtPKR(totProfit)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold">{totMargin.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        <div className="hidden print:flex justify-between mt-8 pt-4 border-t border-gray-300 text-xs text-gray-400">
          <span>Tajir · {tenant.name}</span>
          <span>Printed: {printDate}</span>
        </div>
      </div>
    </div>
  )
}
