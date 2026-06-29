'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { addTicketMessageAction } from '@/app/actions/add-ticket-message'

const STATUS_LABEL: Record<string, string> = {
  open:        'Open',
  in_progress: 'In Progress',
  closed:      'Closed',
}
const STATUS_COLOR: Record<string, string> = {
  open:        'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400',
  closed:      'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400',
}

type Message = {
  id: string
  sender_email: string
  message: string
  is_staff_reply: boolean
  created_at: string
}

type Ticket = { id: string; subject: string; status: 'open' | 'in_progress' | 'closed'; createdAt: string }

export function TicketThread({
  ticket,
  messages,
  currentUserEmail,
}: {
  ticket: Ticket
  messages: Message[]
  currentUserEmail: string
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  const isClosed = ticket.status === 'closed'

  const handleReply = () => {
    if (!text.trim()) return
    start(async () => {
      setError(null)
      const res = await addTicketMessageAction({ ticketId: ticket.id, message: text.trim() })
      if (!res.success) { setError(res.error); return }
      setText('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link href="/support" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3 w-3" /> Back to Support
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">{ticket.subject}</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Opened {new Date(ticket.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLOR[ticket.status]}`}>
              {STATUS_LABEL[ticket.status]}
            </span>
            <a
              href={`/support/${ticket.id}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              <Printer className="h-3 w-3" /> Print
            </a>
          </div>
        </div>
      </div>

      {/* Message thread */}
      <div className="space-y-3">
        {messages.map(msg => {
          const isOwn = !msg.is_staff_reply
          return (
            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                isOwn
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-card border border-border rounded-bl-md'
              }`}>
                <div className={`flex items-center gap-2 mb-1.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <span className={`text-[11px] font-semibold ${isOwn ? 'text-primary-foreground/70' : 'text-primary'}`}>
                    {msg.is_staff_reply ? 'Tajir Support' : (msg.sender_email === currentUserEmail ? 'You' : msg.sender_email)}
                  </span>
                  <span className={`text-[10px] ${isOwn ? 'text-primary-foreground/50' : 'text-muted-foreground'}`}>
                    {new Date(msg.created_at).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isOwn ? 'text-primary-foreground' : 'text-foreground'}`}>
                  {msg.message}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Reply box */}
      {isClosed ? (
        <div className="rounded-xl bg-muted/50 border border-border p-4 text-center text-sm text-muted-foreground">
          This ticket is closed. <Link href="/support/new" className="text-primary font-semibold hover:underline">Open a new ticket</Link> if you need further help.
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Write your reply…"
            rows={4}
            className="resize-none"
            disabled={isPending}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={handleReply} disabled={isPending || !text.trim()} className="gap-2 min-h-[44px]">
              <Send className="h-4 w-4" />
              {isPending ? 'Sending…' : 'Send Reply'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
