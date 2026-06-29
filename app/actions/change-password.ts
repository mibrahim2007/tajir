'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function changePasswordAction(formData: FormData): Promise<ActionResult<null>> {
  const parsed = schema.safeParse({ password: formData.get('password') })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (updateError) {
    return { success: false, error: updateError.message, code: 'INTERNAL_ERROR' }
  }

  // Clear the must_change_password flag — merge with existing app_metadata to preserve role/tenant_id
  const admin = createAdminClient()
  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, must_change_password: false },
  })

  redirect('/dashboard')
}
