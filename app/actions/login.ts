'use server'

import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { tenantUsers } from '@/db/schema'

export async function loginAction(formData: FormData) {
  const username = (formData.get('username') as string | null)?.trim().toLowerCase()
  const password = formData.get('password') as string | null

  if (!username || !password) {
    return { success: false, error: 'Invalid username or password' }
  }

  // Look up the user_id for this username
  const [record] = await db
    .select({ userId: tenantUsers.userId, isActive: tenantUsers.isActive })
    .from(tenantUsers)
    .where(eq(tenantUsers.username, username))
    .limit(1)

  if (!record || !record.isActive) {
    return { success: false, error: 'Invalid username or password' }
  }

  // Retrieve the email from Supabase Auth via admin client
  const admin = createAdminClient()
  const { data: { user }, error: adminError } = await admin.auth.admin.getUserById(record.userId)

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
