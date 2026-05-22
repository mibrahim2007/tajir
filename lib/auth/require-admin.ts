import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AdminContext = {
  user: { id: string; email: string | undefined }
}

export async function requireAdmin(): Promise<AdminContext> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/auth/login')
  if (!user.app_metadata?.is_super_admin) redirect('/dashboard')
  return { user: { id: user.id, email: user.email } }
}
