'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

// Removes a customer↔supplier mapping. Owner-only. Does not touch either
// party's underlying records — only the link between them.
export async function deletePartyLinkAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('party_links')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to remove mapping', code: 'INTERNAL_ERROR' }

  return { success: true, data: undefined }
}
