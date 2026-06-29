'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ name: z.string().min(1, 'Name is required').max(100) })

export async function createItemTypeAction(input: unknown): Promise<ActionResult<{ id: string; name: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('item_types')
    .insert({ tenant_id: tenantId, name: parsed.data.name.trim() })
    .select('id, name')
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'An item type with this name already exists', code: 'DUPLICATE' }
    return { success: false, error: 'Failed to create item type', code: 'INTERNAL_ERROR' }
  }

  return { success: true, data: data! }
}
