'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyAdminNewTicket } from '@/lib/email/send-email'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  subject: z.string().min(3, 'Subject is required').max(200),
  message: z.string().min(10, 'Please describe your issue (min 10 chars)').max(5000),
})

export async function createSupportTicketAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, tenantId } = await requireAuth()
  const tenant = await getTenant(tenantId)

  const admin = createAdminClient()

  const { data: ticket, error: tErr } = await admin
    .from('support_tickets')
    .insert({
      tenant_id:   tenantId,
      user_id:     user.id,
      user_email:  user.email ?? '',
      tenant_name: tenant.name,
      subject:     parsed.data.subject,
      status:      'open',
    })
    .select('id')
    .single()

  if (tErr || !ticket) return { success: false, error: tErr?.message ?? 'Failed to create ticket', code: 'INTERNAL_ERROR' }

  await admin.from('ticket_messages').insert({
    ticket_id:      ticket.id,
    sender_email:   user.email ?? '',
    message:        parsed.data.message,
    is_staff_reply: false,
  })

  /* Email the admin */
  await notifyAdminNewTicket({
    ticketId:   ticket.id,
    tenantName: tenant.name,
    userEmail:  user.email ?? '',
    subject:    parsed.data.subject,
    message:    parsed.data.message,
  })

  return { success: true, data: { id: ticket.id } }
}
