'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { adminReplyTicketAction } from '@/app/actions/admin-reply-ticket'
import { updateTicketStatusAction } from '@/app/actions/update-ticket-status'

const STATUS_COLOR: Record<string, string> = {
  open:        'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  closed:      'bg-green-50 text-green-700 border-green-200',
}
const STATUS_LABEL: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', closed: 'Closed',
}

type Message = { id: string; sender_email: string; message: string; is_staff_reply: boolean; created_at: string }
type Ticket  = { id: string; subject: string; status: 'open' | 'in_progress' | 'closed'; createdAt: string; userEmail: string; tenantName: string }

export function AdminTicketThread({ ticket, messages }: { ticket: Ticket; messages: Message[] }) {
  const router = useRouter()
  const [text, setText]         = useState('')
  const [status, setStatus]     = useState<'open' | 'in_progress' | 'closed'>(ticket.status)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, start]      = useTransition()
  const [statusPending, stStart] = useTransition()

  const handleReply = () => {
    if (!text.trim()) return
    start(async () => {
      setError(null)
      const res = await adminReplyTicketAction({ ticketId: ticket.id, message: text.trim(), status })
      if (!res.success) { setError(res.error); return }
      setText('')
      router.refresh()
    })
  }

  const handleStatusChange = (newStatus: string) => {
    const s = newStatus as 'open' | 'in_progress' | 'closed'
    setStatus(s)
    stStart(async () => {
      await updateTicketStatusAction({ ticketId: ticket.id, status: s })
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link href="/admin/support" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3 w-3" /> All Tickets
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">{ticket.subject}</h1>
            <p className="text-xs text-muted-foreground mt-1">
              {ticket.tenantName} · {ticket.userEmail} · {new Date(ticket.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/admin/support/${ticket.id}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              <Printer className="h-3 w-3" /> Print
            </a>
            <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLOR[status]}`}>
              {STATUS_LABEL[status]}
            </span>
            <Select value={status} onValueChange={handleStatusChange} disabled={statusPending}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Thread */}
      <div className="space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.is_staff_reply ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
              msg.is_staff_reply
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-card border border-border rounded-bl-md'
            }`}>
              <div className={`flex items-center gap-2 mb-1.5 ${msg.is_staff_reply ? 'justify-end' : 'justify-start'}`}>
                <span className={`text-[11px] font-semibold ${msg.is_staff_reply ? 'text-primary-foreground/70' : 'text-primary'}`}>
                  {msg.is_staff_reply ? 'You (Support)' : msg.sender_email}
                </span>
                <span className={`text-[10px] ${msg.is_staff_reply ? 'text-primary-foreground/50' : 'text-muted-foreground'}`}>
                  {new Date(msg.created_at).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className={`text-sm whitespace-pre-wrap leading-relaxed ${msg.is_staff_reply ? 'text-primary-foreground' : 'text-foreground'}`}>
                {msg.message}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Reply box */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type your reply to the user…"
          rows={5}
          className="resize-none"
          disabled={isPending}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Reply status:</span>
            <Select
              value={status}
              onValueChange={v => setStatus(v as 'open' | 'in_progress' | 'closed')}
            >
              <SelectTrigger className="h-7 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleReply} disabled={isPending || !text.trim()} className="gap-2 min-h-[44px]">
            <Send className="h-4 w-4" />
            {isPending ? 'Sending…' : 'Send Reply'}
          </Button>
        </div>
      </div>
    </div>
  )
}
