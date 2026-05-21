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

  // Look up user_id via Supabase REST (no direct DB connection needed)
  const admin = createAdminClient()
  const { data: record, error: lookupError } = await admin
    .from('tenant_users')
    .select('user_id, is_active')
    .eq('username', username)
    .single()

  if (lookupError || !record || !record.is_active) {
    return { success: false, error: 'Invalid username or password' }
  }

  // Retrieve the email from Supabase Auth
  const { data: { user }, error: adminError } = await admin.auth.admin.getUserById(record.user_id)

  if (adminError || !user?.email) {
    return { success: false, error: 'Invalid username or password' }
  }

  // Authenticate with email + password
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  })

  if (error) {
    if (error.message.toLowerCase().includes('ban')) {
      return { success: false, error: 'Your account has been deactivated. Contact your account owner.' }
    }
    return { success: false, error: 'Invalid username or password' }
  }

  redirect('/dashboard')
}
