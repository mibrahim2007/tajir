import Link from 'next/link'
import {
  Package, ShoppingCart, ShoppingBag, ClipboardList,
  ArrowDownLeft, ArrowUpRight,
  Receipt, PenLine, TrendingUp, Landmark, BarChart2, LifeBuoy, Bell, BookOpen, Video, FlaskConical,
} from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { buildReceivablesAging, buildPayablesAging, sumBuckets } from '@/lib/reports/aging'
import { DashboardPeriodTabs } from './period-tabs'
import {
  CHART_VARS, shortPKR, Panel, MiniStat, TrackBars, AgingCard,
  RevenueChart, DonutChart, FeedRow, OptionTile, ActionTile,
} from './dash-parts'

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
    { data: allSaleReturnsData },
    { data: allCreditNotesData },
    { data: allCustomerRefundsData },
    { data: allPurchasesData },
    { data: allPaymentsData },
    { data: allPurchaseReturnsData },
    { data: allDebitNotesData },
    { data: allSupplierRefundsData },
    { data: recentSalesData },
    { data: recentPurchasesData },
    { data: customersData },
    { data: suppliersData },
    { data: inventoryData },
    { data: chartSalesData },
    { data: chartPurchasesData },
    tenant,
    { count: rawSupportCount },
    receivablesAging,
    payablesAging,
  ] = await Promise.all([
    admin.from('sales_orders').select('pkr_equivalent').eq('tenant_id', tenantId).gte('date', monthStart),
    admin.from('purchase_orders').select('pkr_equivalent').eq('tenant_id', tenantId).gte('date', monthStart),
    admin.from('sales_orders').select('pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('ar_receipts').select('pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('tajir_customers').select('opening_balance_pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('sale_returns').select('pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('credit_notes').select('pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('customer_refunds').select('pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('purchase_orders').select('pkr_equivalent, advance_paid').eq('tenant_id', tenantId),
    admin.from('ap_payments').select('pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('purchase_returns').select('pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('debit_notes').select('pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('supplier_refunds').select('pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('sales_orders').select('id, date, customer_id, pkr_equivalent').eq('tenant_id', tenantId).order('date', { ascending: false }).limit(6),
    admin.from('purchase_orders').select('id, date, supplier_id, pkr_equivalent').eq('tenant_id', tenantId).order('date', { ascending: false }).limit(6),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    admin.from('suppliers').select('id, name, opening_balance_pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('inventory_lots')
      .select('id, name, count, current_quantity, item_type_id, item_types(id, name)')
      .eq('tenant_id', tenantId),
    admin.from('sales_orders').select('date, pkr_equivalent').eq('tenant_id', tenantId).gte('date', sixMonAgo),
    admin.from('purchase_orders').select('date, pkr_equivalent').eq('tenant_id', tenantId).gte('date', sixMonAgo),
    getTenant(tenantId),
    supportQ,
    buildReceivablesAging(tenantId),
    buildPayablesAging(tenantId),
  ])
  const supportCount = rawSupportCount ?? 0

  const receivablesBuckets = sumBuckets(receivablesAging)
  const payablesBuckets    = sumBuckets(payablesAging)

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
  const totalInventoryUnits = (inventoryData ?? []).reduce((s, l) => s + parse(l.count), 0)

  /* Receivables & payables — the same formula the Customers and Suppliers
     pages use. Returns, notes and refunds all move a party's balance, so
     leaving them out overstates what is actually owed. */
  const sumPkr = (rows: { pkr_equivalent: unknown }[] | null) =>
    (rows ?? []).reduce((s, r) => s + parse(r.pkr_equivalent), 0)

  const saleReturns    = sumPkr(allSaleReturnsData)
  const creditNotes    = sumPkr(allCreditNotesData)
  const customerRefunds = sumPkr(allCustomerRefundsData)
  const receivables = Math.max(
    0,
    openingBal + totalSales - totalReceipts - saleReturns - creditNotes + customerRefunds,
  )

  const supplierOpeningBal = (suppliersData ?? []).reduce((s, x) => s + parse(x.opening_balance_pkr_equivalent), 0)
  // A purchase records the advance paid on the invoice itself, so only the
  // unpaid remainder is a payable.
  const totalPurchased = (allPurchasesData ?? [])
    .reduce((s, p) => s + parse(p.pkr_equivalent) - parse(p.advance_paid), 0)
  const totalPaid       = sumPkr(allPaymentsData)
  const purchaseReturns = sumPkr(allPurchaseReturnsData)
  const debitNotes      = sumPkr(allDebitNotesData)
  const supplierRefunds = sumPkr(allSupplierRefundsData)
  const payables = Math.max(
    0,
    supplierOpeningBal + totalPurchased - totalPaid - purchaseReturns - debitNotes + supplierRefunds,
  )

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
    const rawT    = lot.item_types as { name: string } | { name: string }[] | null
    const typeName = (Array.isArray(rawT) ? rawT[0]?.name : rawT?.name) ?? 'Uncategorized'
    const key     = (lot.item_type_id as string | null) ?? '__none__'
    const qty     = parse(lot.current_quantity)
    if (qty <= 0) return
    if (!catMap.has(key)) catMap.set(key, { name: typeName, qty: 0, ci: ci++ })
    catMap.get(key)!.qty += qty
  })
  const categoryData = [...catMap.values()]
    .sort((a, b) => b.qty - a.qty)
    .map(c => ({ label: c.name, value: Math.round(c.qty), v: CHART_VARS[c.ci % CHART_VARS.length] }))

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
    { href: '/sales/new',      label: 'Sale',         icon: ShoppingBag },
    { href: '/purchases/new',  label: 'Purchase',     icon: ShoppingCart },
    { href: '/receipts/new',   label: 'Receipt',      icon: ArrowDownLeft },
    { href: '/payments/new',   label: 'Payment',      icon: ArrowUpRight },
    { href: '/gatepasses/new', label: 'Gatepass',     icon: ClipboardList },
    { href: '/expenses/new',   label: 'Expense',      icon: Receipt },
    { href: '/inventory',      label: 'Inventory',    icon: Package },
    { href: '/reports',        label: 'Reports',      icon: BarChart2 },
    { href: '/support',        label: 'Support',      icon: LifeBuoy },
    { href: '/help',           label: 'Help Videos',  icon: Video },
    { href: '/user-guide',     label: 'User Guide',   icon: BookOpen },
    ...(isOwner ? [{ href: '/vouchers/new', label: 'Voucher', icon: PenLine }] : []),
    ...(isOwner ? [{ href: '/playground', label: 'Demo Playground', icon: FlaskConical }] : []),
  ]


  /* Compact stat cluster for the left of the first row. */
  const stats: { label: string; value: string; sub?: string; up?: boolean }[] = [
    { label: 'Sales (MTD)',     value: shortPKR(mtdSales),     sub: `${monthName} ${year}` },
    { label: 'Purchases (MTD)', value: shortPKR(mtdPurchases), sub: `${monthName} ${year}` },
    { label: 'Receivables',     value: shortPKR(receivables),  sub: receivables > 0 ? 'From customers' : 'All settled' },
    { label: 'Payables',        value: shortPKR(payables),     sub: payables > 0 ? 'To suppliers' : 'All settled', up: payables > 0 ? false : undefined },
    {
      label: 'Inventory',
      value: totalInventoryUnits > 0 ? totalInventoryUnits.toLocaleString('en-IN') : String(inventoryData?.length ?? 0),
      sub: totalInventoryUnits > 0 ? 'Units on hand' : 'Items on hand',
    },
    ...(isOwner
      ? [
          { label: 'Collections (MTD)', value: shortPKR(mtdCollections), sub: 'Cash & bank in', up: mtdCollections > 0 ? true : undefined },
          { label: 'Orders (MTD)',      value: mtdOrderCount.toLocaleString('en-IN'), sub: 'Invoices raised' },
          { label: 'Avg Sale (MTD)',    value: shortPKR(avgSale), sub: 'Per invoice' },
          {
            label: 'Gross Margin',
            value: `${grossMarginPct.toFixed(1)}%`,
            sub: grossMarginPct > 0 ? `${shortPKR(mtdSales - mtdPurchases)} net` : 'No margin',
            up: grossMarginPct > 0 ? true : undefined,
          },
        ]
      : []),
  ]

  /* The five-across strip that closes the page. */
  const options = [
    ...(isOwner
      ? [
          { href: '/reports/profit-loss',   label: 'Profit & Loss', icon: TrendingUp },
          { href: '/reports/balance-sheet', label: 'Balance Sheet', icon: Landmark },
        ]
      : []),
    { href: '/reports',    label: 'All Reports',     icon: BarChart2 },
    { href: '/help',       label: 'Video Tutorials', icon: Video },
    { href: '/user-guide', label: 'User Guide',      icon: BookOpen },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-[1500px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">{tenant.name} · {monthName} {year}</p>
        </div>
        <Link
          href="/sales/new"
          className="inline-flex items-center gap-2 text-[13px] font-bold px-4 py-2.5 rounded-xl text-primary-foreground bg-gradient-to-r from-primary to-brand2 glow-primary hover:opacity-90 transition-opacity"
        >
          <ShoppingBag className="h-4 w-4" /> Sale
        </Link>
      </div>

      {/* Support notification banner */}
      {supportCount > 0 && (
        <Link
          href="/support"
          className="flex items-center gap-3 rounded-xl px-4 py-3 border border-warning/40 bg-warning/10 hover:bg-warning/20 transition-colors"
        >
          <Bell className="h-4 w-4 text-warning shrink-0" />
          <p className="text-[13px] font-semibold text-warning flex-1">
            {supportCount === 1
              ? 'You have 1 open support ticket'
              : `You have ${supportCount} open support tickets`}
          </p>
          <span className="text-[11px] font-bold text-warning shrink-0">View →</span>
        </Link>
      )}

      {/*
        Actions first. This used to sit at the bottom, under four screens of
        charts, which put the things people open the dashboard to DO behind
        everything they might want to read. One dense row keeps it from
        pushing the numbers off the fold.
      */}
      <Panel title="Start here" subtitle="Record a document or jump to a list">
        <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-[repeat(13,minmax(0,1fr))] gap-2">
          {quickActions.map((a, i) => <ActionTile key={a.href} {...a} index={i} />)}
        </div>
      </Panel>

      {/*
        First row: the numbers stay a compact cluster on the left instead of a
        full-width band of cards, so the bar chart on the right gets the space
        that actually needs it.
      */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Panel
          className="lg:col-span-5"
          title="Business Overview"
          subtitle={`${monthName} ${year}`}
        >
          <div className="grid grid-cols-2 gap-2.5">
            {stats.map((s, i) => (
              <MiniStat
                key={s.label}
                {...s}
                className={i === stats.length - 1 && stats.length % 2 === 1 ? 'col-span-2' : ''}
              />
            ))}
          </div>
        </Panel>

        <Panel
          className="lg:col-span-7"
          title="Sales by Product"
          subtitle={`Top items · ${periodLabel}`}
          action={isOwner ? <DashboardPeriodTabs current={period} /> : undefined}
        >
          <TrackBars
            data={topProducts}
            vars={CHART_VARS}
            emptyMsg={isOwner ? 'No sales in this period' : 'Owner access required'}
          />
        </Panel>
      </div>

      {/* Second row: composition, activity, trend */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Panel className="lg:col-span-4" title="Stock by Category" subtitle="Current inventory by item type">
          <DonutChart data={categoryData} />
        </Panel>

        <Panel
          className="lg:col-span-4"
          title="Recent Activity"
          subtitle="Sales &amp; purchases"
          action={
            <div className="flex gap-2 text-[11px] font-bold">
              <Link href="/sales" className="text-primary hover:underline">Sales</Link>
              <span className="text-muted-foreground">·</span>
              <Link href="/purchases" className="text-primary hover:underline">Purchases</Link>
            </div>
          }
        >
          {transactions.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="divide-y divide-border/60 -my-2.5">
              {transactions.slice(0, 6).map((txn) => (
                <FeedRow
                  key={`${txn.type}-${txn.id}`}
                  v={txn.type === 'Sale' ? '--chart-2' : '--chart-3'}
                  title={txn.party}
                  meta={`${formatPKTDate(txn.date)} · ${txn.type}`}
                  right={formatPKR(txn.amount)}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          className="lg:col-span-4"
          title="Revenue vs Purchases"
          subtitle="Last 6 months (PKR)"
          action={
            <div className="flex gap-3 text-[10px] font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-chart-1" />Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-chart-2" />Purchases
              </span>
            </div>
          }
        >
          <RevenueChart months={chartMonths} revenue={chartRevenue} purchases={chartPurchases} />
        </Panel>
      </div>

      {/* Aging — how overdue the two balances above actually are */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AgingCard
          title="Receivables Aging"
          href="/reports/receivables-aging"
          buckets={receivablesBuckets}
          emptyMsg="No outstanding receivables"
        />
        <AgingCard
          title="Payables Aging"
          href="/reports/payables-aging"
          buckets={payablesBuckets}
          emptyMsg="No outstanding payables"
        />
      </div>

      {/* Owner: who the sales came from */}
      {isOwner && (
        <Panel title="Sales by Party" subtitle={`Top customers · ${periodLabel}`}>
          <TrackBars
            data={topParties}
            vars={['--chart-4', '--chart-5', '--chart-6', '--chart-1', '--chart-2', '--chart-3', '--chart-7']}
            emptyMsg="No sales in this period"
          />
        </Panel>
      )}

      {/* Closing strip: vibrant icon on top, label beneath, coloured rule */}
      <div className="panel px-2 py-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x lg:divide-border/60">
          {options.map((o, i) => <OptionTile key={o.href} {...o} index={i} />)}
        </div>
      </div>
    </div>
  )
}
