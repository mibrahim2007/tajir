import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { TicketThread } from './ticket-thread'

export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, role, tenantId } = await requireAuth()
  const admin = createAdminClient()

  const { data: ticket } = await admin
    .from('support_tickets')
    .select('id, subject, status, created_at, user_email, tenant_name, user_id, closed_reviewed')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!ticket) notFound()

  /* Non-owners can only see their own tickets */
  if (role !== 'owner' && ticket.user_id !== user.id) notFound()

  /* Mark closed ticket as reviewed the moment the user opens it */
  if (ticket.status === 'closed' && !ticket.closed_reviewed) {
    await admin.from('support_tickets').update({ closed_reviewed: true }).eq('id', id)
  }

  const { data: messages } = await admin
    .from('ticket_messages')
    .select('id, sender_email, message, is_staff_reply, created_at')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <TicketThread
        ticket={{ id: ticket.id, subject: ticket.subject, status: ticket.status as 'open'|'in_progress'|'closed', createdAt: ticket.created_at as string }}
        messages={messages ?? []}
        currentUserEmail={user.email ?? ''}
      />
    </div>
  )
}
