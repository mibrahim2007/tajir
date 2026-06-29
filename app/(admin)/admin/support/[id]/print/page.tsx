import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { PrintButton } from './print-button'

export default async function AdminPrintSupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
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

  const STATUS_LABEL: Record<string, string> = {
    open: 'Open', in_progress: 'In Progress', closed: 'Closed',
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Screen toolbar — hidden on print */}
      <div className="print:hidden flex items-center gap-3 px-6 py-4 border-b bg-background sticky top-0">
        <Link href={`/admin/support/${id}`}>
          <Button variant="ghost" size="sm">← Back</Button>
        </Link>
        <span className="text-sm text-muted-foreground flex-1">
          Ticket: {ticket.subject}
        </span>
        <PrintButton />
      </div>

      {/* Print content */}
      <div className="max-w-2xl mx-auto px-8 py-10 print:px-0 print:py-0 print:max-w-none">

        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-black pb-4">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Support Ticket</p>
          <h1 className="text-2xl font-bold">{ticket.subject}</h1>
        </div>

        {/* Ticket meta */}
        <table className="w-full text-sm mb-8 border border-gray-300">
          <tbody>
            <Row label="Ticket ID"    value={ticket.id.slice(0, 8).toUpperCase()} />
            <Row label="Status"       value={STATUS_LABEL[ticket.status] ?? ticket.status} />
            <Row label="Submitted by" value={ticket.user_email} />
            <Row label="Company"      value={ticket.tenant_name} />
            <Row label="Date"         value={new Date(ticket.created_at as string).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
          </tbody>
        </table>

        {/* Messages */}
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 border-b border-gray-200 pb-2">
          Conversation ({(messages ?? []).length} message{(messages ?? []).length !== 1 ? 's' : ''})
        </h2>

        <div className="space-y-4 mb-10">
          {(messages ?? []).map((msg) => (
            <div key={msg.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className={`flex items-center justify-between px-4 py-2 text-xs ${msg.is_staff_reply ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'}`}>
                <span className="font-semibold">
                  {msg.is_staff_reply ? 'Tajir Support (You)' : msg.sender_email}
                </span>
                <span className="opacity-75">
                  {new Date(msg.created_at).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed">
                {msg.message}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-300 pt-4 text-xs text-gray-400 flex justify-between">
          <span>Tajir Support · tajir.jappx.com</span>
          <span>Printed: {new Date().toLocaleString('en-PK', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-gray-200 last:border-0">
      <td className="px-4 py-2.5 font-medium text-gray-500 w-36 bg-gray-50 border-r border-gray-200 text-sm">{label}</td>
      <td className="px-4 py-2.5 text-sm font-medium">{value}</td>
    </tr>
  )
}
