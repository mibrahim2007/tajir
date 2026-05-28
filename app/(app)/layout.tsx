import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { AuthProvider } from '@/contexts/auth-context'
import { SubscriptionLockedBanner } from '@/components/subscription-locked-banner'
import { LogoutButton } from '@/components/logout-button'

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
        <header className="border-b bg-background sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
            <Link href="/dashboard" className="font-semibold text-lg shrink-0">
              Tajir
            </Link>
            <nav className="flex items-center gap-1 overflow-x-auto">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm px-3 py-2 rounded-md hover:bg-accent whitespace-nowrap min-h-[44px] flex items-center"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </AuthProvider>
  )
}
