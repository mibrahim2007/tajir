import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/db/schema'

export type AuthContext = {
  user: { id: string; email: string | undefined }
  role: Role
  tenantId: string
}

export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/login')
  }

  const role = user.app_metadata?.role as Role | undefined
  const tenantId = user.app_metadata?.tenant_id as string | undefined

  if (!role || !tenantId) {
    redirect('/auth/login')
  }

  if (user.app_metadata?.must_change_password === true) {
    redirect('/auth/change-password')
  }

  return {
    user: { id: user.id, email: user.email },
    role,
    tenantId,
  }
}
