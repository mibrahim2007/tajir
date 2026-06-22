'use server'

import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  ticketId: z.string().uuid(),
  status:   z.enum(['open', 'in_progress', 'closed']),
})

export async function updateTicketStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('support_tickets')
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.ticketId)

  if (error) return { success: false, error: error.message, code: 'INTERNAL_ERROR' }
  return { success: true, data: undefined }
}
