import Link from 'next/link'
import {
  Package, ShoppingCart, ShoppingBag, ClipboardList,
  ArrowDownLeft, ArrowUpRight, ArrowDownRight,
  Receipt, PenLine, TrendingUp, Landmark, BarChart2, LifeBuoy, Bell, BookOpen,
} from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { DashboardPeriodTabs } from './period-tabs'

const CHART_COLORS = ['#0d9488', '#8b5cf6', '#f59e0b', '#3b82f6', '#ef4444', '#10b981', '#ec4899', '#f97316']

function shortPKR(n: number): string {
  if (n >= 1_00_00_000) return `Rs ${(n / 1_00_00_000).toFixed(1)}Cr`
  if (n >= 1_00_000)    return `Rs ${(n / 1_00_000).toFixed(1)}L`
  if (n >= 1_000)       return `Rs ${(n / 1_000).toFixed(0)}K`
  return formatPKR(n)
}

function KpiCard({ label, value, sub, up }: { label: string; value: string; sub?: string; up?: boolean }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">{label}</p>
      <p className="font-extrabold text-2xl tracking-tight font-mono text-foreground leading-none">{value}</p>
      {sub && (
        <p className={`text-xs mt-2 flex items-center gap-1 font-medium ${up === true ? 'text-primary' : up === false ? 'text-destructive' : 'text-muted-foreground'}`}>
          {up === true && <ArrowUpRight className="h-3 w-3" />}
          {up === false && <ArrowDownRight className="h-3 w-3" />}
          {sub}
        </p>
      )}
    </div>
  )
}

function QuickAction({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  return (
    <Link href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-secondary hover:border-primary/30 transition-all text-sm font-semibold text-foreground group">
      <span className="h-8 w-8 rounded-lg bg-accent text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        <Icon className="h-4 w-4" />
      </span>
      {label}
    </Link>
  )
}

function RevenueChart({ months, revenue, purchases }: { months: string[]; revenue: number[]; purchases: number[] }) {
  const W = 600, H = 180
  const padL = 8, padR = 8, padT = 12, padB = 28
  const pw = W - padL - padR
  const ph = H - padT - padB
  const n = months.length
  if (n < 2) return null

  const maxVal = Math.max(...revenue, ...purchases, 1)
  const x = (i: number) => +(padL + (i / (n - 1)) * pw).toFixed(1)
  const y = (v: number) => +(padT + (1 - v / maxVal) * ph).toFixed(1)

  const revPts  = months.map((_, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(revenue[i])}`).join(' ')
  const purPts  = months.map((_, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(purchases[i])}`).join(' ')
  const revArea = `${revPts} L${x(n - 1)},${padT + ph} L${x(0)},${padT + ph}Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }} aria-hidden="true">
      <defs>
        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d9488" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#0d9488" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={revArea} fill="url(#revGrad)" />
      <path d={revPts} fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={purPts} fill="none" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="5 4" strokeLinecap="round" />
      {months.map((m, i) => (
        <text key={m} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" style={{ fill: 'var(--muted-foreground)', fontFamily: 'inherit' }}>{m}</text>
      ))}
    </svg>
  )
}

function HBarChart({ data, barColor, emptyMsg }: {
  data: { label: string; value: number }[]
  barColor?: string
  emptyMsg?: string
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyMsg ?? 'No data'}</p>
  }
  const max = Math.max(...data.map(d => d.value), 1)
  const color = barColor ?? '#0d9488'
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={i} className="grid items-center gap-2" style={{ gridTemplateColumns: '110px 1fr 60px' }}>
          <p className="text-xs text-muted-foreground truncate" title={d.label}>{d.label}</p>
          <div className="h-5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.max((d.value / max) * 100, 3)}%`, backgroundColor: color }}
            />
          </div>
          <p className="text-xs font-mono font-semibold text-right">{shortPKR(d.value)}</p>
        </div>
      ))}
    </div>
  )
}

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const filtered = [...data].filter(d => d.value > 0).sort((a, b) => b.value - a.value)
  if (filtered.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No stock in categories</p>
  }

  const total = filtered.reduce((s, d) => s + d.value, 0)
  const cx = 80, cy = 80, R = 65, ir = 40
  const f = (n: number) => n.toFixed(1)
  const totalStr = total >= 100_000 ? `${(total / 1_000).toFixed(0)}K` : total.toLocaleString('en-IN')

  let paths: { d: string; color: string }[] = []

  if (filtered.length === 1) {
    /* Single segment — render as two semicircles */
    paths = [{
      color: filtered[0].color,
      d: [
        `M${f(cx + R)},${f(cy)}`,
        `A${R},${R} 0 0,1 ${f(cx - R)},${f(cy)}`,
        `A${R},${R} 0 0,1 ${f(cx + R)},${f(cy)}`,
        `M${f(cx + ir)},${f(cy)}`,
        `A${ir},${ir} 0 0,0 ${f(cx - ir)},${f(cy)}`,
        `A${ir},${ir} 0 0,0 ${f(cx + ir)},${f(cy)}`,
        `Z`,
      ].join(' '),
    }]
  } else {
    let angle = -Math.PI / 2
    filtered.forEach((seg, idx) => {
      const sweep = (seg.value / total) * 2 * Math.PI
      const ea    = angle + sweep
      const lg    = sweep > Math.PI ? 1 : 0
      const ox1 = cx + R * Math.cos(angle),  oy1 = cy + R * Math.sin(angle)
      const ox2 = cx + R * Math.cos(ea),     oy2 = cy + R * Math.sin(ea)
      const ix1 = cx + ir * Math.cos(ea),    iy1 = cy + ir * Math.sin(ea)
      const ix2 = cx + ir * Math.cos(angle), iy2 = cy + ir * Math.sin(angle)
      paths.push({
        color: seg.color,
        d: `M${f(ox1)},${f(oy1)} A${R},${R} 0 ${lg},1 ${f(ox2)},${f(oy2)} L${f(ix1)},${f(iy1)} A${ir},${ir} 0 ${lg},0 ${f(ix2)},${f(iy2)} Z`,
      })
      angle = ea
    })
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg viewBox="0 0 160 160" className="w-36 h-36 shrink-0" aria-hidden>
        {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} />)}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fontWeight="bold" style={{ fill: 'var(--foreground)', fontFamily: 'inherit' }}>
          {totalStr}
        </text>
        <text x={cx} y={cy + 11} textAnchor="middle" fontSize="9" style={{ fill: 'var(--muted-foreground)', fontFamily: 'inherit' }}>
          units
        </text>
      </svg>
      <div className="space-y-2 flex-1 min-w-0">
        {filtered.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-xs text-foreground truncate flex-1">{seg.label}</span>
            <span className="text-xs font-mono text-muted-foreground shrink-0">
              {seg.value.toLocaleString('en-IN')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { user, tenantId, role } = await requireAuth()
  const admin   = createAdminClient()
  const isOwner = role === 'owner'

  const sp     = await searchParams
  const period = sp?.period ?? 'mtd'

  const now        = new Date()
  const todayStr   = now.toISOString().split('T')[0]
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const sixMonAgo  = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0]
  const monthName  = now.toLocaleString('en-US', { month: 'long', timeZone: 'Asia/Karachi' })
  const year       = now.getFullYear()

  /* Period for analytics charts */
  let periodFrom: string, periodTo: string, periodLabel: string
  if (period === 'last_month') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const e = new Date(now.getFullYear(), now.getMonth(), 0)
    periodFrom  = d.toISOString().split('T')[0]
    periodTo    = e.toISOString().split('T')[0]
    periodLabel = d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  } else if (period === 'last_3m') {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    periodFrom  = d.toISOString().split('T')[0]
    periodTo    = todayStr
    periodLabel = 'Last 3 Months'
  } else if (period === 'ytd') {
    periodFrom  = `${year}-01-01`
    periodTo    = todayStr
    periodLabel = `Year ${year}`
  } else {
    periodFrom  = monthStart
    periodTo    = todayStr
    periodLabel = `${monthName} ${year}`
  }

  let supportQ = admin
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('status', ['open', 'in_progress'])
  if (!isOwner) supportQ = supportQ.eq('user_id', user.id)

  const [
    { data: mtdSalesData },
    { data: mtdPurchasesData },
    { data: allSalesData },
    { data: allReceiptsData },
    { data: allCustomersData },
    { data: recentSalesData },
    { data: recentPurchasesData },
    { data: customersData },
    { data: suppliersData },
    { data: inventoryData },
    { data: chartSalesData },
    { data: chartPurchasesData },
    tenant,
    { count: rawSupportCount },
  ] = await Promise.all([
    admin.from('sales_orders').select('pkr_equivalent').eq('tenant_id', tenantId).gte('date', monthStart),
    admin.from('purchase_orders').select('pkr_equivalent').eq('tenant_id', tenantId).gte('date', monthStart),
    admin.from('sales_orders').select('pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('ar_receipts').select('pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('tajir_customers').select('opening_balance_pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('sales_orders').select('id, date, customer_id, pkr_equivalent').eq('tenant_id', tenantId).order('date', { ascending: false }).limit(6),
    admin.from('purchase_orders').select('id, date, supplier_id, pkr_equivalent').eq('tenant_id', tenantId).order('date', { ascending: false }).limit(6),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId),
    admin.from('inventory_lots')
      .select('id, name, count, current_quantity, item_type_id, item_types(id, name)')
      .eq('tenant_id', tenantId),
    admin.from('sales_orders').select('date, pkr_equivalent').eq('tenant_id', tenantId).gte('date', sixMonAgo),
    admin.from('purchase_orders').select('date, pkr_equivalent').eq('tenant_id', tenantId).gte('date', sixMonAgo),
    getTenant(tenantId),
    supportQ,
  ])
  const supportCount = rawSupportCount ?? 0

  const parse = (v: unknown) => parseFloat((v as string) || '0') || 0

  /* Owner-only queries */
  let periodSalesRows: { stock_item_id: unknown; customer_id: unknown; pkr_equivalent: unknown }[] = []
  let mtdCollections  = 0
  let mtdOrderCount   = 0

  if (isOwner) {
    const [
      { data: psd },
      { data: mrd },
      { count: moc },
    ] = await Promise.all([
      admin.from('sales_orders')
        .select('stock_item_id, customer_id, pkr_equivalent')
        .eq('tenant_id', tenantId)
        .gte('date', periodFrom)
        .lte('date', periodTo),
      admin.from('ar_receipts').select('pkr_equivalent').eq('tenant_id', tenantId).gte('date', monthStart),
      admin.from('sales_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('date', monthStart),
    ])
    periodSalesRows = psd ?? []
    mtdCollections  = (mrd ?? []).reduce((s, r) => s + parse(r.pkr_equivalent), 0)
    mtdOrderCount   = moc ?? 0
  }

  const mtdSales      = (mtdSalesData ?? []).reduce((s, r) => s + parse(r.pkr_equivalent), 0)
  const mtdPurchases  = (mtdPurchasesData ?? []).reduce((s, r) => s + parse(r.pkr_equivalent), 0)
  const totalSales    = (allSalesData ?? []).reduce((s, r) => s + parse(r.pkr_equivalent), 0)
  const totalReceipts = (allReceiptsData ?? []).reduce((s, r) => s + parse(r.pkr_equivalent), 0)
  const openingBal    = (allCustomersData ?? []).reduce((s, c) => s + parse(c.opening_balance_pkr_equivalent), 0)
  const receivables   = Math.max(0, openingBal + totalSales - totalReceipts)
  const totalInventoryUnits = (inventoryData ?? []).reduce((s, l) => s + parse(l.count), 0)

  /* 6-month revenue chart */
  const months6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    return {
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('en-US', { month: 'short' }),
    }
  })
  const bucket = new Map(months6.map(m => [m.key, { rev: 0, pur: 0 }]))
  ;(chartSalesData ?? []).forEach(r => {
    const k = (r.date as string).substring(0, 7)
    if (bucket.has(k)) bucket.get(k)!.rev += parse(r.pkr_equivalent)
  })
  ;(chartPurchasesData ?? []).forEach(r => {
    const k = (r.date as string).substring(0, 7)
    if (bucket.has(k)) bucket.get(k)!.pur += parse(r.pkr_equivalent)
  })
  const chartMonths    = months6.map(m => m.label)
  const chartRevenue   = months6.map(m => bucket.get(m.key)!.rev)
  const chartPurchases = months6.map(m => bucket.get(m.key)!.pur)

  /* Recent transactions */
  const customerMap = new Map((customersData ?? []).map(c => [c.id, c.name]))
  const supplierMap = new Map((suppliersData ?? []).map(s => [s.id, s.name]))
  type Txn = { id: string; date: string; type: 'Sale' | 'Purchase'; party: string; amount: number }
  const transactions: Txn[] = [
    ...(recentSalesData ?? []).map(s => ({ id: s.id, date: s.date as string, type: 'Sale' as const, party: customerMap.get(s.customer_id as string) ?? '—', amount: parse(s.pkr_equivalent) })),
    ...(recentPurchasesData ?? []).map(p => ({ id: p.id, date: p.date as string, type: 'Purchase' as const, party: supplierMap.get(p.supplier_id as string) ?? '—', amount: parse(p.pkr_equivalent) })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8)

  /* ── Category chart (all users) ── */
  const catMap = new Map<string, { name: string; qty: number; ci: number }>()
  let ci = 0
  ;(inventoryData ?? []).forEach(lot => {
    const rawT    = lot.item_types as unknown
    const typeName = Array.isArray(rawT) ? (rawT[0] as any)?.name ?? 'Uncategorized' : (rawT as any)?.name ?? 'Uncategorized'
    const key     = (lot.item_type_id as string | null) ?? '__none__'
    const qty     = parse(lot.current_quantity)
    if (qty <= 0) return
    if (!catMap.has(key)) catMap.set(key, { name: typeName, qty: 0, ci: ci++ })
    catMap.get(key)!.qty += qty
  })
  const categoryData = [...catMap.values()]
    .sort((a, b) => b.qty - a.qty)
    .map(c => ({ label: c.name, value: Math.round(c.qty), color: CHART_COLORS[c.ci % CHART_COLORS.length] }))

  /* ── Owner: Sales charts ── */
  const lotNameMap = new Map((inventoryData ?? []).map(l => [l.id as string, l.name as string]))
  const productTotals = new Map<string, number>()
  const partyTotals   = new Map<string, number>()
  periodSalesRows.forEach(s => {
    const amt  = parse(s.pkr_equivalent)
    const item = s.stock_item_id as string
    const cust = s.customer_id as string
    productTotals.set(item, (productTotals.get(item) ?? 0) + amt)
    partyTotals.set(cust,   (partyTotals.get(cust)   ?? 0) + amt)
  })
  const topProducts = [...productTotals.entries()]
    .sort(([, a], [, b]) => b - a).slice(0, 7)
    .map(([id, v]) => ({ label: lotNameMap.get(id) ?? 'Item', value: v }))
  const topParties = [...partyTotals.entries()]
    .sort(([, a], [, b]) => b - a).slice(0, 7)
    .map(([id, v]) => ({ label: customerMap.get(id) ?? 'Customer', value: v }))

  /* ── Owner: Extra KPIs ── */
  const avgSale       = mtdOrderCount > 0 ? mtdSales / mtdOrderCount : 0
  const grossMarginPct = mtdSales > 0 ? ((mtdSales - mtdPurchases) / mtdSales) * 100 : 0

  const quickActions = [
    { href: '/sales/new',      label: 'New Sale',     icon: ShoppingBag },
    { href: '/purchases/new',  label: 'New Purchase', icon: ShoppingCart },
    { href: '/receipts/new',   label: 'New Receipt',  icon: ArrowDownLeft },
    { href: '/payments/new',   label: 'New Payment',  icon: ArrowUpRight },
    { href: '/gatepasses/new', label: 'New Gatepass', icon: ClipboardList },
    { href: '/expenses/new',   label: 'New Expense',  icon: Receipt },
    { href: '/inventory',      label: 'Inventory',    icon: Package },
    { href: '/reports',        label: 'Reports',      icon: BarChart2 },
    { href: '/support',        label: 'Support',      icon: LifeBuoy },
    { href: '/user-guide',     label: 'User Guide',   icon: BookOpen },
    ...(isOwner ? [{ href: '/vouchers/new', label: 'New Voucher', icon: PenLine }] : []),
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{tenant.name} · {monthName} {year}</p>
        </div>
        <Link href="/sales/new"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
          <ShoppingBag className="h-4 w-4" /> New Sale
        </Link>
      </div>

      {/* Support notification banner */}
      {supportCount > 0 && (
        <Link
          href="/support"
          className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 hover:opacity-90 transition-opacity"
        >
          <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex-1">
            {supportCount === 1
              ? 'You have 1 open support ticket'
              : `You have ${supportCount} open support tickets`}
          </p>
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400 shrink-0">View →</span>
        </Link>
      )}

      {/* Base KPIs — all users */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Sales (MTD)"     value={shortPKR(mtdSales)}     sub={`${monthName} ${year}`} />
        <KpiCard label="Purchases (MTD)" value={shortPKR(mtdPurchases)} sub={`${monthName} ${year}`} />
        <KpiCard label="Receivables"     value={shortPKR(receivables)}  sub={receivables > 0 ? 'Outstanding from customers' : 'All settled'} />
        <KpiCard label="Inventory"       value={totalInventoryUnits > 0 ? totalInventoryUnits.toLocaleString('en-IN') + ' units' : (inventoryData?.length ?? 0) + ' items'} sub="Stock on hand" />
      </div>

      {/* Owner: Sales KPIs */}
      {isOwner && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Orders (MTD)"
            value={mtdOrderCount.toLocaleString('en-IN')}
            sub={`${monthName} ${year}`}
          />
          <KpiCard
            label="Avg Sale (MTD)"
            value={shortPKR(avgSale)}
            sub="Per order"
          />
          <KpiCard
            label="Collections (MTD)"
            value={shortPKR(mtdCollections)}
            sub="Cash & bank received"
            up={mtdCollections > 0}
          />
          <KpiCard
            label="Gross Margin (MTD)"
            value={`${grossMarginPct.toFixed(1)}%`}
            sub={grossMarginPct > 0 ? `Rs ${((mtdSales - mtdPurchases) / 1_00_000).toFixed(1)}L net` : 'No margin'}
            up={grossMarginPct > 0}
          />
        </div>
      )}

      {/* Owner: Sales analytics charts with period selector */}
      {isOwner && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-bold text-sm text-foreground">Sales Analytics</p>
              <p className="text-xs text-muted-foreground mt-0.5">By product and party · {periodLabel}</p>
            </div>
            <DashboardPeriodTabs current={period} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Sales by Product */}
            <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
              <p className="font-bold text-sm text-foreground">Sales by Product</p>
              <p className="text-xs text-muted-foreground mt-0.5 mb-4">Top items · {periodLabel}</p>
              <HBarChart
                data={topProducts}
                barColor="#0d9488"
                emptyMsg="No sales in this period"
              />
            </div>

            {/* Sales by Party */}
            <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
              <p className="font-bold text-sm text-foreground">Sales by Party</p>
              <p className="text-xs text-muted-foreground mt-0.5 mb-4">Top customers · {periodLabel}</p>
              <HBarChart
                data={topParties}
                barColor="#8b5cf6"
                emptyMsg="No sales in this period"
              />
            </div>
          </div>
        </div>
      )}

      {/* Stock by Category — all users */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
        <p className="font-bold text-sm text-foreground">Stock by Category</p>
        <p className="text-xs text-muted-foreground mt-0.5 mb-4">Current inventory by item type</p>
        <DonutChart data={categoryData} />
      </div>

      {/* Revenue vs Purchases (6-month trend) */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-bold text-sm text-foreground">Revenue vs Purchases</p>
            <p className="text-xs text-muted-foreground mt-0.5">Last 6 months (PKR)</p>
          </div>
          <div className="flex gap-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" /></svg>
              Revenue
            </span>
            <span className="flex items-center gap-2">
              <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="5 4" strokeLinecap="round" /></svg>
              Purchases
            </span>
          </div>
        </div>
        <RevenueChart months={chartMonths} revenue={chartRevenue} purchases={chartPurchases} />
      </div>

      {/* Recent Transactions + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <p className="font-bold text-sm text-foreground">Recent Transactions</p>
              <p className="text-xs text-muted-foreground mt-0.5">Sales & purchases</p>
            </div>
            <div className="flex gap-2">
              <Link href="/sales"     className="text-xs text-primary font-semibold hover:underline">Sales</Link>
              <span className="text-muted-foreground text-xs">·</span>
              <Link href="/purchases" className="text-xs text-primary font-semibold hover:underline">Purchases</Link>
            </div>
          </div>
          {transactions.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No transactions yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map((txn) => (
                <div key={`${txn.type}-${txn.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                      txn.type === 'Sale'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'
                    }`}>
                      {txn.type === 'Sale' ? 'S' : 'P'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{txn.party}</p>
                      <p className="text-xs text-muted-foreground">{formatPKTDate(txn.date)} · {txn.type}</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold font-mono text-foreground shrink-0 ml-4">{formatPKR(txn.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="font-bold text-sm text-foreground">Quick Actions</p>
            <p className="text-xs text-muted-foreground mt-0.5">Common operations</p>
          </div>
          <div className="p-3 grid grid-cols-1 gap-1.5">
            {quickActions.map((a) => <QuickAction key={a.href} {...a} />)}
          </div>
        </div>
      </div>

      {/* Owner: Report shortcuts */}
      {isOwner && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { href: '/reports/profit-loss',   label: 'Profit & Loss', icon: TrendingUp, sub: 'Income statement' },
            { href: '/reports/balance-sheet', label: 'Balance Sheet', icon: Landmark,   sub: 'Assets & liabilities' },
            { href: '/reports',               label: 'All Reports',   icon: BarChart2,  sub: 'Aging, GL & more' },
          ].map((r) => (
            <Link key={r.href} href={r.href}
              className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3.5 hover:border-primary/40 hover:bg-secondary/50 transition-all group">
              <span className="h-9 w-9 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <r.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* User Guide card */}
      <Link href="/user-guide"
        className="flex items-center gap-4 bg-card border border-border rounded-2xl px-5 py-4 hover:border-primary/40 hover:bg-secondary/30 transition-all group shadow-sm">
        <span className="h-10 w-10 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <BookOpen className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground">User Guide <span className="text-muted-foreground font-normal">/ صارف راہنما</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">Step-by-step instructions for all features, in English and Urdu. Print or save as PDF.</p>
        </div>
        <span className="text-xs font-semibold text-muted-foreground shrink-0 group-hover:text-primary transition-colors">Open →</span>
      </Link>
    </div>
  )
}
