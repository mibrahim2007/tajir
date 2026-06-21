import Link from 'next/link'
import {
  Package, ShoppingCart, ShoppingBag, ClipboardList,
  ArrowDownLeft, ArrowUpRight, ArrowDownRight,
  Receipt, PenLine, TrendingUp, Landmark, BarChart2,
} from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

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

export default async function DashboardPage() {
  const { tenantId, role } = await requireAuth()
  const [tenant] = await Promise.all([getTenant(tenantId)])
  const admin = createAdminClient()
  const isOwner = role === 'owner'

  const now = new Date()
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const sixMonthAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0]
  const monthName   = now.toLocaleString('en-US', { month: 'long', timeZone: 'Asia/Karachi' })
  const year        = now.getFullYear()

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
    admin.from('inventory_lots').select('id, count').eq('tenant_id', tenantId),
    admin.from('sales_orders').select('date, pkr_equivalent').eq('tenant_id', tenantId).gte('date', sixMonthAgo),
    admin.from('purchase_orders').select('date, pkr_equivalent').eq('tenant_id', tenantId).gte('date', sixMonthAgo),
  ])

  const parse = (v: unknown) => parseFloat((v as string) || '0') || 0

  const mtdSales      = (mtdSalesData ?? []).reduce((s, r) => s + parse(r.pkr_equivalent), 0)
  const mtdPurchases  = (mtdPurchasesData ?? []).reduce((s, r) => s + parse(r.pkr_equivalent), 0)
  const totalSales    = (allSalesData ?? []).reduce((s, r) => s + parse(r.pkr_equivalent), 0)
  const totalReceipts = (allReceiptsData ?? []).reduce((s, r) => s + parse(r.pkr_equivalent), 0)
  const openingBal    = (allCustomersData ?? []).reduce((s, c) => s + parse(c.opening_balance_pkr_equivalent), 0)
  const receivables   = Math.max(0, openingBal + totalSales - totalReceipts)
  const totalInventoryUnits = (inventoryData ?? []).reduce((s, l) => s + parse(l.count), 0)

  // Build 6-month chart data
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

  const customerMap = new Map((customersData ?? []).map(c => [c.id, c.name]))
  const supplierMap = new Map((suppliersData ?? []).map(s => [s.id, s.name]))

  type Txn = { id: string; date: string; type: 'Sale' | 'Purchase'; party: string; amount: number }
  const transactions: Txn[] = [
    ...(recentSalesData ?? []).map(s => ({ id: s.id, date: s.date as string, type: 'Sale' as const, party: customerMap.get(s.customer_id as string) ?? '—', amount: parse(s.pkr_equivalent) })),
    ...(recentPurchasesData ?? []).map(p => ({ id: p.id, date: p.date as string, type: 'Purchase' as const, party: supplierMap.get(p.supplier_id as string) ?? '—', amount: parse(p.pkr_equivalent) })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8)

  const quickActions = [
    { href: '/sales/new',      label: 'New Sale',     icon: ShoppingBag },
    { href: '/purchases/new',  label: 'New Purchase', icon: ShoppingCart },
    { href: '/receipts/new',   label: 'New Receipt',  icon: ArrowDownLeft },
    { href: '/payments/new',   label: 'New Payment',  icon: ArrowUpRight },
    { href: '/gatepasses/new', label: 'New Gatepass', icon: ClipboardList },
    { href: '/expenses/new',   label: 'New Expense',  icon: Receipt },
    { href: '/inventory',      label: 'Inventory',    icon: Package },
    { href: '/reports',        label: 'Reports',      icon: BarChart2 },
    ...(isOwner ? [{ href: '/vouchers/new', label: 'New Voucher', icon: PenLine }] : []),
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Page header */}
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

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Sales (MTD)"    value={shortPKR(mtdSales)}    sub={`${monthName} ${year}`} />
        <KpiCard label="Purchases (MTD)" value={shortPKR(mtdPurchases)} sub={`${monthName} ${year}`} />
        <KpiCard label="Receivables"    value={shortPKR(receivables)}  sub={receivables > 0 ? 'Outstanding from customers' : 'All settled'} />
        <KpiCard label="Inventory"      value={totalInventoryUnits > 0 ? totalInventoryUnits.toLocaleString('en-IN') + ' units' : (inventoryData?.length ?? 0) + ' lots'} sub="Stock on hand" />
      </div>

      {/* Revenue vs Purchases chart */}
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

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Recent transactions */}
        <div className="lg:col-span-3 bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <p className="font-bold text-sm text-foreground">Recent Transactions</p>
              <p className="text-xs text-muted-foreground mt-0.5">Sales & purchases</p>
            </div>
            <div className="flex gap-2">
              <Link href="/sales" className="text-xs text-primary font-semibold hover:underline">Sales</Link>
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

        {/* Quick actions */}
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

      {/* Owner reports row */}
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
    </div>
  )
}
