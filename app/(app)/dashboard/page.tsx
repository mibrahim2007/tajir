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
  color: string
}

function Section({ title, tiles }: { title: string; tiles: Tile[] }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="flex items-start gap-3 rounded-xl border bg-card p-4 hover:bg-accent hover:border-accent-foreground/20 transition-colors min-h-[44px] group"
          >
            <div className={`mt-0.5 rounded-lg p-1.5 ${t.color}`}>
              <t.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight">{t.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{t.description}</p>
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
    { href: '/sales/new',      label: 'New Sale',      description: 'Create a sale order',   icon: ShoppingBag,   color: 'bg-green-100 text-green-700' },
    { href: '/purchases/new',  label: 'New Purchase',  description: 'Record a purchase',     icon: ShoppingCart,  color: 'bg-orange-100 text-orange-700' },
    { href: '/gatepasses/new', label: 'New Gatepass',  description: 'Issue a gatepass',      icon: ClipboardList, color: 'bg-yellow-100 text-yellow-700' },
    { href: '/inventory',      label: 'Inventory',     description: 'View stock levels',     icon: Package,       color: 'bg-blue-100 text-blue-700' },
  ]

  const returnTiles: Tile[] = [
    { href: '/sale-returns/new',     label: 'Sale Return',     description: 'Customer return',    icon: RefreshCcw, color: 'bg-pink-100 text-pink-700' },
    { href: '/purchase-returns/new', label: 'Purchase Return', description: 'Return to supplier', icon: Undo2,      color: 'bg-red-100 text-red-700' },
  ]

  const financeTiles: Tile[] = [
    { href: '/receipts/new', label: 'New Receipt',  description: 'Customer payment received', icon: ArrowDownLeft, color: 'bg-cyan-100 text-cyan-700' },
    { href: '/payments/new', label: 'New Payment',  description: 'Supplier payment made',     icon: ArrowUpRight,  color: 'bg-violet-100 text-violet-700' },
    { href: '/expenses/new', label: 'New Expense',  description: 'Record a cash expense',     icon: Receipt,       color: 'bg-rose-100 text-rose-700' },
    ...(isOwner ? [{ href: '/vouchers/new', label: 'New Voucher', description: 'Manual journal entry', icon: PenLine, color: 'bg-teal-100 text-teal-700' }] : []),
  ]

  const reportTiles: Tile[] = [
    { href: '/reports/profit-loss',  label: 'Profit & Loss',  description: 'Income statement',       icon: TrendingUp, color: 'bg-emerald-100 text-emerald-700' },
    { href: '/reports/balance-sheet', label: 'Balance Sheet', description: 'Assets & liabilities',   icon: Landmark,   color: 'bg-indigo-100 text-indigo-700' },
    { href: '/reports',              label: 'All Reports',    description: 'Aging, GL & more',       icon: BarChart2,  color: 'bg-purple-100 text-purple-700' },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{tenant.name}</h1>
        <p className="text-sm text-muted-foreground mt-1 capitalize">{role} account</p>
      </div>

      <Section title="Trading" tiles={tradingTiles} />
      <Section title="Returns" tiles={returnTiles} />
      <Section title="Finance" tiles={financeTiles} />
      {isOwner && <Section title="Reports" tiles={reportTiles} />}
    </div>
  )
}
