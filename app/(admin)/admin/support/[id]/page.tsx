import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminTicketThread } from './admin-ticket-thread'

export default async function AdminTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAdmin()
  const admin = createAdminClient()

  const { data: ticket } = await admin
    .from('support_tickets')
    .select('id, subject, status, created_at, user_email, tenant_name')
    .eq('id', id)
    .single()

  if (!ticket) notFound()

  const { data: messages } = await admin
    .from('ticket_messages')
    .select('id, sender_email, message, is_staff_reply, created_at')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <AdminTicketThread
        ticket={{
          id: ticket.id,
          subject: ticket.subject,
          status: ticket.status as 'open' | 'in_progress' | 'closed',
          createdAt: ticket.created_at as string,
          userEmail: ticket.user_email,
          tenantName: ticket.tenant_name,
        }}
        messages={messages ?? []}
      />
    </div>
  )
}
