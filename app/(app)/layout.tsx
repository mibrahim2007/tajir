import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { AuthProvider } from '@/contexts/auth-context'
import { SubscriptionLockedBanner } from '@/components/subscription-locked-banner'
import { DesktopSidebar, MobileHeader } from '@/components/sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, role, tenantId } = await requireAuth()
  const tenant = await getTenant(tenantId)

  const sidebarProps = {
    role,
    userEmail: user.email ?? '',
    tenantName: tenant.name,
  }

  return (
    <AuthProvider value={{ userId: user.id, role, tenantId }}>
      <SubscriptionLockedBanner status={tenant.subscriptionStatus} />
      <div className="flex min-h-screen">
        <DesktopSidebar {...sidebarProps} />
        <div className="flex-1 flex flex-col min-w-0">
          <MobileHeader {...sidebarProps} />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </AuthProvider>
  )
}
