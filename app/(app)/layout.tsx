import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { AuthProvider } from '@/contexts/auth-context'
import { SubscriptionLockedBanner } from '@/components/subscription-locked-banner'
import { DesktopSidebar, MobileHeader } from '@/components/sidebar'
import { CommandPalette } from '@/components/command-palette'
import {
  parseTenantFeatures,
  parseUserPermissions,
  computeEffectiveModules,
  type ModuleKey,
} from '@/lib/modules'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, role, tenantId } = await requireAuth()
  const admin = createAdminClient()

  let supportQ = admin
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .or('status.in.(open,in_progress),and(status.eq.closed,closed_reviewed.eq.false)')
  if (role !== 'owner') supportQ = supportQ.eq('user_id', user.id)

  const [tenant, { count: rawSupportCount }, { data: tenantUserRow }] = await Promise.all([
    getTenant(tenantId),
    supportQ,
    admin
      .from('tenant_users')
      .select('permissions')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .single(),
  ])

  const tenantFeatures = parseTenantFeatures((tenant as { features?: unknown }).features)
  const userPermissions = parseUserPermissions(tenantUserRow?.permissions ?? null)
  const effectiveModules = [...computeEffectiveModules(role, tenantFeatures, userPermissions)] as ModuleKey[]

  const supportCount = rawSupportCount ?? 0

  const sidebarProps = {
    role,
    userEmail: user.email ?? '',
    tenantName: tenant.name,
    supportCount,
    enabledModules: effectiveModules,
  }

  return (
    <AuthProvider value={{ userId: user.id, role, tenantId }}>
      <CommandPalette role={role} />
      <SubscriptionLockedBanner status={tenant.subscriptionStatus} />
      <div className="flex min-h-screen">
        <div className="print:hidden"><DesktopSidebar {...sidebarProps} /></div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="print:hidden"><MobileHeader {...sidebarProps} /></div>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </AuthProvider>
  )
}
