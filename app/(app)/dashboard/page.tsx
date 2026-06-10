import Link from 'next/link'
import {
  Package, ShoppingCart, ShoppingBag, ClipboardList,
  Undo2, RefreshCcw, ArrowDownLeft, ArrowUpRight,
  Receipt, PenLine, TrendingUp, Landmark, BarChart2,
} from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'

type Tile = {
  href: string
  label: string
  description: string
  icon: React.ElementType
  gradient: string
}

function Section({ title, accent, tiles }: { title: string; accent: string; tiles: Tile[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className={`h-5 w-1.5 rounded-full bg-gradient-to-b ${accent}`} />
        <h2 className="text-sm font-bold text-foreground/80 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`group relative flex items-start gap-3 overflow-hidden rounded-2xl bg-gradient-to-br ${t.gradient} p-4 text-white shadow-md shadow-black/5 ring-1 ring-white/10 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/10 min-h-[44px]`}
          >
            <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/15 blur-xl transition-transform duration-300 group-hover:scale-150" />
            <div className="relative mt-0.5 rounded-xl bg-white/20 p-2 ring-1 ring-white/30 backdrop-blur-sm transition-transform duration-200 group-hover:scale-110">
              <t.icon className="h-5 w-5" />
            </div>
            <div className="relative min-w-0">
              <p className="font-bold text-sm leading-tight drop-shadow-sm">{t.label}</p>
              <p className="text-xs text-white/85 mt-0.5 leading-tight">{t.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const { tenantId, role } = await requireAuth()
  const tenant = await getTenant(tenantId)
  void tenant.subscriptionStatus

  const isOwner = role === 'owner'

  const tradingTiles: Tile[] = [
    { href: '/sales/new',      label: 'New Sale',      description: 'Create a sale order',   icon: ShoppingBag,   gradient: 'from-emerald-500 to-green-600' },
    { href: '/purchases/new',  label: 'New Purchase',  description: 'Record a purchase',     icon: ShoppingCart,  gradient: 'from-orange-500 to-amber-600' },
    { href: '/gatepasses/new', label: 'New Gatepass',  description: 'Issue a gatepass',      icon: ClipboardList, gradient: 'from-yellow-400 to-amber-500' },
    { href: '/inventory',      label: 'Inventory',     description: 'View stock levels',     icon: Package,       gradient: 'from-sky-500 to-blue-600' },
  ]

  const returnTiles: Tile[] = [
    { href: '/sale-returns/new',     label: 'Sale Return',     description: 'Customer return',    icon: RefreshCcw, gradient: 'from-pink-500 to-rose-600' },
    { href: '/purchase-returns/new', label: 'Purchase Return', description: 'Return to supplier', icon: Undo2,      gradient: 'from-red-500 to-rose-600' },
  ]

  const financeTiles: Tile[] = [
    { href: '/receipts/new', label: 'New Receipt',  description: 'Customer payment received', icon: ArrowDownLeft, gradient: 'from-cyan-500 to-teal-600' },
    { href: '/payments/new', label: 'New Payment',  description: 'Supplier payment made',     icon: ArrowUpRight,  gradient: 'from-violet-500 to-purple-600' },
    { href: '/expenses/new', label: 'New Expense',  description: 'Record a cash expense',     icon: Receipt,       gradient: 'from-rose-500 to-pink-600' },
    ...(isOwner ? [{ href: '/vouchers/new', label: 'New Voucher', description: 'Manual journal entry', icon: PenLine, gradient: 'from-teal-500 to-emerald-600' }] : []),
  ]

  const reportTiles: Tile[] = [
    { href: '/reports/profit-loss',  label: 'Profit & Loss',  description: 'Income statement',       icon: TrendingUp, gradient: 'from-emerald-500 to-teal-600' },
    { href: '/reports/balance-sheet', label: 'Balance Sheet', description: 'Assets & liabilities',   icon: Landmark,   gradient: 'from-indigo-500 to-blue-600' },
    { href: '/reports',              label: 'All Reports',    description: 'Aging, GL & more',       icon: BarChart2,  gradient: 'from-fuchsia-500 to-purple-600' },
  ]

  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-indigo-50 via-sky-50 to-transparent dark:from-indigo-950/40 dark:via-sky-950/20" />
      <div className="relative p-6 max-w-3xl mx-auto space-y-8">
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 p-6 text-white shadow-lg shadow-purple-500/20">
          <h1 className="text-2xl font-bold drop-shadow-sm">{tenant.name}</h1>
          <p className="text-sm text-white/85 mt-1 capitalize">{role} account · Welcome back 👋</p>
        </div>

        <Section title="Trading"  accent="from-emerald-400 to-green-500"  tiles={tradingTiles} />
        <Section title="Returns"  accent="from-pink-400 to-rose-500"      tiles={returnTiles} />
        <Section title="Finance"  accent="from-violet-400 to-purple-500"  tiles={financeTiles} />
        {isOwner && <Section title="Reports" accent="from-indigo-400 to-blue-500" tiles={reportTiles} />}
      </div>
    </div>
  )
}
