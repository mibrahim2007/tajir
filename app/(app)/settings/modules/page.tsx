import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { parseTenantFeatures, type ModuleKey } from '@/lib/modules'
import { ModuleToggles } from './module-toggles'

export default async function ModulesSettingsPage() {
  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') redirect('/dashboard')

  const admin = createAdminClient()
  const { data: tenant } = await admin
    .from('tenants')
    .select('features')
    .eq('id', tenantId)
    .single()

  const tenantFeatures = parseTenantFeatures((tenant as { features?: unknown } | null)?.features)

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Modules</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which modules are active for your account. Disabled modules are hidden for everyone.
        </p>
      </div>
      <ModuleToggles initialEnabled={[...tenantFeatures] as ModuleKey[]} />
    </div>
  )
}
