'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function loginAction(formData: FormData) {
  const username = (formData.get('username') as string | null)?.trim().toLowerCase()
  const password = formData.get('password') as string | null

  if (!username || !password) {
    return { success: false, error: 'Invalid username or password' }
  }

  const admin = createAdminClient()
  const supabase = await createClient()

  // Try tenant username lookup first
  const { data: record } = await admin
    .from('tenant_users')
    .select('user_id, is_active')
    .eq('username', username)
    .single()

  if (record) {
    if (!record.is_active) {
      return { success: false, error: 'Invalid username or password' }
    }

    const { data: { user }, error: adminError } = await admin.auth.admin.getUserById(record.user_id)
    if (adminError || !user?.email) {
      return { success: false, error: 'Invalid username or password' }
    }

    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password })
    if (error) {
      if (error.message.toLowerCase().includes('ban')) {
        return { success: false, error: 'Your account has been deactivated. Contact your account owner.' }
      }
      return { success: false, error: 'Invalid username or password' }
    }

    redirect('/dashboard')
  }

  // Fallback: treat username as email (for super admin accounts)
  const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
    email: username,
    password,
  })

  if (signInError || !user) {
    return { success: false, error: 'Invalid username or password' }
  }

  if (user.app_metadata?.is_super_admin) {
    redirect('/admin')
  }

  return { success: false, error: 'Invalid username or password' }
}
