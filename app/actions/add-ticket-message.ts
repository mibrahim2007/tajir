'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyAdminNewReply } from '@/lib/email/send-email'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  ticketId: z.string().uuid(),
  message:  z.string().min(1, 'Message is required').max(5000),
})

export async function addTicketMessageAction(input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, tenantId } = await requireAuth()
  const admin = createAdminClient()

  /* Verify ticket belongs to this tenant */
  const { data: ticket } = await admin
    .from('support_tickets')
    .select('id, subject, tenant_name, status')
    .eq('id', parsed.data.ticketId)
    .eq('tenant_id', tenantId)
    .single()

  if (!ticket) return { success: false, error: 'Ticket not found', code: 'NOT_FOUND' }
  if (ticket.status === 'closed') return { success: false, error: 'This ticket is closed. Please open a new ticket.', code: 'VALIDATION_ERROR' }

  await admin.from('ticket_messages').insert({
    ticket_id:      ticket.id,
    sender_email:   user.email ?? '',
    message:        parsed.data.message,
    is_staff_reply: false,
  })

  await admin.from('support_tickets').update({ updated_at: new Date().toISOString(), status: 'open' }).eq('id', ticket.id)

  await notifyAdminNewReply({
    ticketId:   ticket.id,
    tenantName: ticket.tenant_name,
    userEmail:  user.email ?? '',
    subject:    ticket.subject,
    message:    parsed.data.message,
  })

  return { success: true, data: undefined }
}
