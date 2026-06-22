'use server'

import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUserStaffReply } from '@/lib/email/send-email'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  ticketId: z.string().uuid(),
  message:  z.string().min(1, 'Reply cannot be empty').max(5000),
  status:   z.enum(['open', 'in_progress', 'closed']).optional(),
})

export async function adminReplyTicketAction(input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user } = await requireAdmin()
  const admin = createAdminClient()

  const { data: ticket } = await admin
    .from('support_tickets')
    .select('id, subject, user_email, status')
    .eq('id', parsed.data.ticketId)
    .single()

  if (!ticket) return { success: false, error: 'Ticket not found', code: 'NOT_FOUND' }

  await admin.from('ticket_messages').insert({
    ticket_id:      ticket.id,
    sender_email:   user.email ?? 'tajiradmin@tajir.app',
    message:        parsed.data.message,
    is_staff_reply: true,
  })

  const newStatus = parsed.data.status ?? 'in_progress'
  await admin.from('support_tickets')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', ticket.id)

  await notifyUserStaffReply({
    ticketId:  ticket.id,
    userEmail: ticket.user_email,
    subject:   ticket.subject,
    message:   parsed.data.message,
  })

  return { success: true, data: undefined }
}
