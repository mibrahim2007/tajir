import { createAdminClient } from '@/lib/supabase/admin'
import type { Tenant, SubscriptionStatus } from '@/db/schema'

export async function getTenant(tenantId: string): Promise<Tenant> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tenants')
    .select('id, name, ntn, subscription_status, subscription_expires_at, created_at')
    .eq('id', tenantId)
    .single()

  if (error || !data) {
    throw new Error(`Tenant not found: ${tenantId}`)
  }

  return {
    id: data.id,
    name: data.name,
    ntn: data.ntn ?? null,
    subscriptionStatus: data.subscription_status as SubscriptionStatus,
    subscriptionExpiresAt: data.subscription_expires_at ? new Date(data.subscription_expires_at) : null,
    createdAt: new Date(data.created_at),
  }
}
