import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { AuthProvider } from '@/contexts/auth-context'
import { SubscriptionLockedBanner } from '@/components/subscription-locked-banner'
import { LogoutButton } from '@/components/logout-button'
import { AppNav } from '@/components/app-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, role, tenantId } = await requireAuth()
  const tenant = await getTenant(tenantId)

  const ownerLinks = [
    { href: '/inventory', label: 'Inventory' },
    { href: '/purchases', label: 'Purchases' },
    { href: '/purchase-returns', label: 'Purch. Returns' },
    { href: '/payments', label: 'Payments' },
    { href: '/suppliers', label: 'Suppliers' },
    { href: '/sales', label: 'Sales' },
    { href: '/sale-returns', label: 'Sale Returns' },
    { href: '/receipts', label: 'Receipts' },
    { href: '/customers', label: 'Customers' },
    { href: '/gatepasses', label: 'Gatepasses' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/expenses', label: 'Expenses' },
    { href: '/accounts', label: 'Accounts' },
    { href: '/vouchers', label: 'Vouchers' },
    { href: '/reports', label: 'Reports' },
    { href: '/audit', label: 'Audit' },
    { href: '/settings/team', label: 'Team' },
    { href: '/settings/opening-balances', label: 'Opening Balances' },
  ]

  const assistantLinks = [
    { href: '/inventory', label: 'Inventory' },
    { href: '/purchases', label: 'Purchases' },
    { href: '/purchase-returns', label: 'Purch. Returns' },
    { href: '/sales', label: 'Sales' },
    { href: '/sale-returns', label: 'Sale Returns' },
    { href: '/gatepasses', label: 'Gatepasses' },
  ]

  const navLinks = role === 'owner' ? ownerLinks : assistantLinks

  return (
    <AuthProvider value={{ userId: user.id, role, tenantId }}>
      <div className="min-h-screen flex flex-col">
        <SubscriptionLockedBanner status={tenant.subscriptionStatus} />
        <header className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 shadow-md shadow-purple-500/20">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
            <Link href="/dashboard" className="font-bold text-lg shrink-0 text-white drop-shadow-sm tracking-tight">
              Tajir
            </Link>
            <AppNav links={navLinks} />
            <div className="shrink-0 [&_button]:text-white [&_button:hover]:bg-white/15 [&_button:hover]:text-white">
              <LogoutButton />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </AuthProvider>
  )
}
