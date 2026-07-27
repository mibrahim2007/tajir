import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/db/schema'

export type AuthContext = {
  user: { id: string; email: string | undefined }
  role: Role
  tenantId: string
}

// Sent when the session cookie exists but is no longer usable.
//
// The proxy admits the request on getClaims(), which only verifies the JWT
// locally, while this runs getUser(), which asks the auth server and rejects a
// revoked or stale session. Without the marker the two disagree forever: this
// redirects to /auth/login, the proxy sees a decodable cookie and bounces
// straight back to /dashboard, and the browser gives up with
// ERR_TOO_MANY_REDIRECTS — locked out with no way to reach the login form.
// The marker tells the proxy to let the login page render so the bad cookie
// can be cleared and replaced. See lib/supabase/proxy.ts.
export const EXPIRED_SESSION_PARAM = 'expired'
const LOGIN_EXPIRED = `/auth/login?${EXPIRED_SESSION_PARAM}=1`

export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect(LOGIN_EXPIRED)
  }

  const role = user.app_metadata?.role as Role | undefined
  const tenantId = user.app_metadata?.tenant_id as string | undefined

  if (!role || !tenantId) {
    redirect(LOGIN_EXPIRED)
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
