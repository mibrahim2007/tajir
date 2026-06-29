import Link from 'next/link'
import { MessageSquare, AlertCircle, Clock, CheckCircle } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

const STATUS_META = {
  open:        { label: 'Open',        color: 'bg-blue-50 text-blue-700 border-blue-200',   icon: AlertCircle },
  in_progress: { label: 'In Progress', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  closed:      { label: 'Closed',      color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle },
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams
  const filterStatus = sp.status ?? 'open'

  const admin = createAdminClient()

  let query = admin
    .from('support_tickets')
    .select('id, tenant_name, user_email, subject, status, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100)

  if (filterStatus !== 'all') {
    query = query.eq('status', filterStatus)
  }

  const { data: tickets } = await query

  const tabs = [
    { key: 'open',        label: 'Open'        },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'closed',      label: 'Closed'      },
    { key: 'all',         label: 'All'         },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Support Tickets</h1>
        <p className="text-sm text-muted-foreground mt-1">All tenant support requests</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl mb-5 w-fit">
        {tabs.map(t => (
          <Link
            key={t.key}
            href={`/admin/support?status=${t.key}`}
            className={[
              'px-4 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap',
              filterStatus === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {(!tickets || tickets.length === 0) ? (
        <div className="border border-dashed rounded-2xl py-16 text-center text-sm text-muted-foreground">
          No tickets with status &quot;{filterStatus}&quot;.
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map(ticket => {
            const meta = STATUS_META[ticket.status as keyof typeof STATUS_META] ?? STATUS_META.open
            const Icon = meta.icon
            return (
              <Link
                key={ticket.id}
                href={`/admin/support/${ticket.id}`}
                className="flex items-center gap-4 bg-card rounded-2xl border border-border p-4 hover:border-primary/40 hover:bg-secondary/30 transition-all group"
              >
                <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <MessageSquare className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{ticket.subject}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {ticket.tenant_name} · {ticket.user_email} · {new Date(ticket.updated_at as string).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${meta.color}`}>
                  <Icon className="h-3 w-3" /> {meta.label}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
