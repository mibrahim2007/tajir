'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

export async function deleteBankAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid ID', code: 'VALIDATION_ERROR' }

  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can delete banks', code: 'UNAUTHORIZED' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('banks')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to delete bank', code: 'INTERNAL_ERROR' }
  return { success: true, data: null }
}
