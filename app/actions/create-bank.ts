'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  name:           z.string().min(1, 'Bank name is required'),
  accountNumber:  z.string().optional(),
  branch:         z.string().optional(),
  openingBalance: z.coerce.number().default(0),
})

export async function createBankAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can manage banks', code: 'UNAUTHORIZED' }

  const { name, accountNumber, branch, openingBalance } = parsed.data
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('banks')
    .insert({ tenant_id: tenantId, name, account_number: accountNumber || null, branch: branch || null, opening_balance: openingBalance })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: 'Failed to create bank', code: 'INTERNAL_ERROR' }
  return { success: true, data }
}
