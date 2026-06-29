import Link from 'next/link'
import { Plus, MessageSquare, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'

const STATUS_META = {
  open:        { label: 'Open',        color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',   icon: AlertCircle },
  in_progress: { label: 'In Progress', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800', icon: Clock },
  closed:      { label: 'Closed',      color: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800', icon: CheckCircle },
}

export default async function SupportPage() {
  const { user, role, tenantId } = await requireAuth()
  const admin = createAdminClient()

  let query = admin
    .from('support_tickets')
    .select('id, subject, status, created_at, updated_at, user_email, closed_reviewed')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (role !== 'owner') {
    query = query.eq('user_id', user.id)
  }

  const { data: tickets } = await query

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Support</h1>
          <p className="text-sm text-muted-foreground mt-1">Submit queries and track responses from our team</p>
        </div>
        <Button asChild className="min-h-[44px] gap-2">
          <Link href="/support/new"><Plus className="size-4" /> New Ticket</Link>
        </Button>
      </div>

      {(!tickets || tickets.length === 0) ? (
        <div className="bg-card rounded-2xl border border-dashed py-20 text-center shadow-sm">
          <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">No tickets yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Click &quot;New Ticket&quot; to submit a query to our support team.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map(ticket => {
            const meta = STATUS_META[ticket.status as keyof typeof STATUS_META] ?? STATUS_META.open
            const Icon = meta.icon
            return (
              <Link
                key={ticket.id}
                href={`/support/${ticket.id}`}
                className="flex items-center gap-4 bg-card rounded-2xl border border-border p-4 shadow-sm hover:border-primary/40 hover:bg-secondary/30 transition-all group"
              >
                <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <MessageSquare className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {role === 'owner' && ticket.user_email !== user.email ? `${ticket.user_email} · ` : ''}
                    {new Date(ticket.updated_at as string).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ticket.status === 'closed' && !ticket.closed_reviewed && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground">
                      New Reply
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.color}`}>
                    <Icon className="h-3 w-3" /> {meta.label}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
