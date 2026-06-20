'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  id:   z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(100),
})

export async function editItemTypeAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('item_types')
    .update({ name: parsed.data.name.trim() })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) {
    if (error.code === '23505') return { success: false, error: 'An item type with this name already exists', code: 'DUPLICATE' }
    return { success: false, error: 'Failed to update item type', code: 'INTERNAL_ERROR' }
  }

  return { success: true, data: undefined }
}
