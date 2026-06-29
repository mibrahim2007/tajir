import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/db/schema'

export type RouteAuthContext = {
  userId: string
  role: Role
  tenantId: string
}

export async function requireAuthRoute(): Promise<RouteAuthContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const role = user.app_metadata?.role as Role | undefined
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!role || !tenantId) return null
  return { userId: user.id, role, tenantId }
}
