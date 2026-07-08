'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid(), isActive: z.boolean() })

// Activates/deactivates a user-created account. Deactivating is a soft hide
// (keeps history, removes it from posting/report pickers). System accounts are
// protected. Never deletes data.
export async function setAccountActiveAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can manage accounts', code: 'UNAUTHORIZED' }

  const { id, isActive } = parsed.data
  const admin = createAdminClient()

  const { data: account } = await admin
    .from('chart_of_accounts')
    .select('is_system')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!account) return { success: false, error: 'Account not found', code: 'NOT_FOUND' }
  if (account.is_system) return { success: false, error: 'System accounts cannot be deactivated', code: 'SYSTEM_ACCOUNT' }

  const { error } = await admin
    .from('chart_of_accounts')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update account', code: 'INTERNAL_ERROR' }
  return { success: true, data: undefined }
}
