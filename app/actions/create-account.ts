'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'
import { ACCOUNT_TYPES } from '@/lib/accounting/account-types'

const schema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(10, 'Code must be 10 characters or fewer'),
  name: z.string().trim().min(1, 'Name is required').max(200),
  accountType: z.enum(ACCOUNT_TYPES),
  parentCode: z.string().trim().max(10).optional(),
  isHeader: z.boolean().optional(),
})

// Creates a single GL account manually (owner-only). Complements the standard
// CoA seed and CSV upload. User-created accounts are never system accounts.
export async function createAccountAction(input: unknown): Promise<ActionResult<{ id: string; code: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can manage accounts', code: 'UNAUTHORIZED' }

  const { code, name, accountType, parentCode, isHeader } = parsed.data
  const admin = createAdminClient()

  // If a parent is given, confirm it exists for this tenant (avoids orphan codes).
  if (parentCode) {
    const { data: parent } = await admin
      .from('chart_of_accounts')
      .select('code')
      .eq('tenant_id', tenantId)
      .eq('code', parentCode)
      .maybeSingle()
    if (!parent) return { success: false, error: 'Parent account not found', code: 'PARENT_NOT_FOUND' }
  }

  const { data, error } = await admin
    .from('chart_of_accounts')
    .insert({
      tenant_id: tenantId,
      code,
      name,
      account_type: accountType,
      parent_code: parentCode || null,
      is_header: isHeader ?? false,
      is_system: false,
      system_key: null,
      is_active: true,
    })
    .select('id, code')
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      return { success: false, error: `Account code "${code}" already exists`, code: 'DUPLICATE' }
    }
    if (error?.code === '23514') {
      return { success: false, error: 'Invalid account type', code: 'VALIDATION_ERROR' }
    }
    return { success: false, error: 'Failed to create account', code: 'INTERNAL_ERROR' }
  }

  return { success: true, data }
}
