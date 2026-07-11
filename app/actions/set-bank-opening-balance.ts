'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  id:             z.string().uuid('Invalid bank'),
  openingBalance: z.coerce.number(),
})

// Sets a bank's opening balance — the amount it held before Tajir started
// tracking it. This seeds the running balance in the Bank Statement report; it
// does not post to the general ledger.
export async function setBankOpeningBalanceAction(input: unknown): Promise<ActionResult<{ openingBalance: number }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can manage banks', code: 'UNAUTHORIZED' }

  const { id, openingBalance } = parsed.data
  const admin = createAdminClient()

  const { error } = await admin
    .from('banks')
    .update({ opening_balance: openingBalance })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update opening balance', code: 'INTERNAL_ERROR' }
  return { success: true, data: { openingBalance } }
}
