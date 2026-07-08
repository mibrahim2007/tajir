'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'
import { ACCOUNT_TYPES } from '@/lib/accounting/account-types'

const schema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Name is required').max(200),
  accountType: z.enum(ACCOUNT_TYPES),
  parentCode: z.string().trim().max(10).optional(),
  isHeader: z.boolean().optional(),
})

// Edits a user-created GL account. Code is immutable here (it identifies the
// account and is referenced as parent_code by children). System accounts are
// protected. Re-parenting is validated against self-parenting and cycles.
export async function editAccountAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can manage accounts', code: 'UNAUTHORIZED' }

  const { id, name, accountType, parentCode, isHeader } = parsed.data
  const admin = createAdminClient()

  const { data: account } = await admin
    .from('chart_of_accounts')
    .select('code, is_system')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!account) return { success: false, error: 'Account not found', code: 'NOT_FOUND' }
  if (account.is_system) return { success: false, error: 'System accounts cannot be edited', code: 'SYSTEM_ACCOUNT' }

  if (parentCode) {
    if (parentCode === account.code) return { success: false, error: 'An account cannot be its own parent', code: 'INVALID_PARENT' }

    const { data: all } = await admin.from('chart_of_accounts').select('code, parent_code').eq('tenant_id', tenantId)
    const parentOf = new Map((all ?? []).map((a) => [a.code, a.parent_code]))
    if (!parentOf.has(parentCode)) return { success: false, error: 'Parent account not found', code: 'PARENT_NOT_FOUND' }

    // Walk up from the proposed parent; reaching this account's code means the
    // parent is actually a descendant → would create a loop.
    let cur: string | null = parentCode
    const seen = new Set<string>()
    while (cur) {
      if (cur === account.code) return { success: false, error: 'That parent would create a loop', code: 'CYCLE' }
      if (seen.has(cur)) break
      seen.add(cur)
      cur = parentOf.get(cur) ?? null
    }
  }

  const { error } = await admin
    .from('chart_of_accounts')
    .update({ name, account_type: accountType, parent_code: parentCode || null, is_header: isHeader ?? false })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update account', code: 'INTERNAL_ERROR' }
  return { success: true, data: undefined }
}
