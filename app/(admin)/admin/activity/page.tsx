import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKTDateTime } from '@/lib/utils/dates'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ActivityDatePicker } from './date-picker'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/* ─── helpers ─────────────────────────────────────────────────────────── */

function pktToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' })
}

function prevDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  dt.setDate(dt.getDate() - 1)
  return dt.toISOString().slice(0, 10)
}

function nextDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  dt.setDate(dt.getDate() + 1)
  return dt.toISOString().slice(0, 10)
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PK', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  update: 'bg-blue-100  text-blue-700  dark:bg-blue-900/30  dark:text-blue-400',
  delete: 'bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-400',
}

const ENTITY_LABELS: Record<string, string> = {
  purchase_orders:    'Purchases',
  sales_orders:       'Sales',
  inventory_lots:     'Inventory',
  suppliers:          'Suppliers',
  tajir_customers:    'Customers',
  ap_payments:        'Payments',
  ar_receipts:        'Receipts',
  gatepasses:         'Gatepasses',
  vouchers:           'Vouchers',
  customer_price_lists: 'Pricing',
  tenant_users:       'Users',
  tenants:            'Tenants',
  sale_returns:       'Sale Returns',
  purchase_returns:   'Purchase Returns',
  stock_transfers:    'Stock Transfers',
  expenses:           'Expenses',
}

/* ─── page ────────────────────────────────────────────────────────────── */

export default async function ActivityPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin()
  const params   = await searchParams
  const date     = typeof params.date === 'string' ? params.date : pktToday()
  const today    = pktToday()
  const isToday  = date === today

  const admin = createAdminClient()

  /* Raw activity rows for the selected PKT date */
  const { data: rows } = await admin
    .from('audit_log')
    .select(`
      id, action, entity, created_at, user_id, tenant_id,
      tenants!inner ( name )
    `)
    .gte('created_at', `${date}T00:00:00+05:00`)
    .lt('created_at',  `${nextDate(date)}T00:00:00+05:00`)
    .order('created_at', { ascending: false })

  const entries = rows ?? []

  /* Collect unique user_ids then fetch emails */
  const userIds = [...new Set(entries.map((e) => e.user_id).filter(Boolean))]
  const emailMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 })
    for (const u of users?.users ?? []) {
      emailMap[u.id] = u.email ?? u.id
    }
  }

  /* ── Aggregate ───────────────────────────────────────────────────────── */
  type UserSummary = {
    userId:     string
    email:      string
    actions:    { action: string; entity: string; count: number }[]
    total:      number
    firstAt:    string
    lastAt:     string
  }
  type TenantSummary = {
    tenantId:   string
    tenantName: string
    users:      Map<string, UserSummary>
    total:      number
  }

  const tenantMap = new Map<string, TenantSummary>()

  for (const row of entries) {
    const tId   = row.tenant_id
    const tName = (row.tenants as unknown as { name: string } | null)?.name ?? tId
    const uId   = row.user_id ?? 'unknown'
    const email = emailMap[uId] ?? uId

    if (!tenantMap.has(tId)) {
      tenantMap.set(tId, { tenantId: tId, tenantName: tName, users: new Map(), total: 0 })
    }
    const tenant = tenantMap.get(tId)!

    if (!tenant.users.has(uId)) {
      tenant.users.set(uId, {
        userId: uId, email,
        actions: [], total: 0,
        firstAt: row.created_at, lastAt: row.created_at,
      })
    }
    const user = tenant.users.get(uId)!

    const existing = user.actions.find((a) => a.action === row.action && a.entity === row.entity)
    if (existing) { existing.count++ } else { user.actions.push({ action: row.action, entity: row.entity, count: 1 }) }

    user.total++
    if (row.created_at < user.firstAt) user.firstAt = row.created_at
    if (row.created_at > user.lastAt)  user.lastAt  = row.created_at
    tenant.total++
  }

  const tenants = [...tenantMap.values()].sort((a, b) => b.total - a.total)

  const totalActions  = entries.length
  const activeTenants = tenantMap.size
  const activeUsers   = new Set(entries.map((e) => e.user_id)).size

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Daily Activity</h1>
          <p className="text-sm text-muted-foreground mt-1">
            User actions across all tenants — Pakistan Standard Time
          </p>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/activity?date=${prevDate(date)}`}
            className="h-9 w-9 rounded-md border flex items-center justify-center hover:bg-accent"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <ActivityDatePicker date={date} max={today} />
          <Link
            href={`/admin/activity?date=${nextDate(date)}`}
            className={`h-9 w-9 rounded-md border flex items-center justify-center ${isToday ? 'opacity-40 pointer-events-none' : 'hover:bg-accent'}`}
          >
            <ChevronRight className="size-4" />
          </Link>
          {!isToday && (
            <Link href="/admin/activity" className="h-9 px-3 rounded-md border text-sm flex items-center hover:bg-accent">
              Today
            </Link>
          )}
        </div>
      </div>

      {/* Date label */}
      <p className="text-sm font-medium text-muted-foreground mb-5">{fmtDate(date)}</p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        {[
          { label: 'Total Actions', value: totalActions },
          { label: 'Active Tenants', value: activeTenants },
          { label: 'Active Users', value: activeUsers },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className="text-3xl font-bold tabular-nums mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-16 text-center">
          <p className="text-muted-foreground text-sm">No activity recorded for this date.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {tenants.map((tenant) => (
            <div key={tenant.tenantId} className="rounded-lg border bg-card overflow-hidden">
              {/* Tenant header */}
              <div className="px-4 py-3 bg-muted/40 border-b flex items-center justify-between">
                <div>
                  <span className="font-semibold text-sm">{tenant.tenantName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {tenant.users.size} user{tenant.users.size !== 1 ? 's' : ''} · {tenant.total} action{tenant.total !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{tenant.tenantId.slice(0, 8)}…</span>
              </div>

              {/* Per-user rows */}
              <div className="divide-y">
                {[...tenant.users.values()].sort((a, b) => b.total - a.total).map((user) => (
                  <div key={user.userId} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-sm font-medium">{user.email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatPKTDateTime(new Date(user.firstAt))}
                          {user.firstAt !== user.lastAt && <> — {formatPKTDateTime(new Date(user.lastAt))}</>}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-right">
                        {user.total} action{user.total !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Action breakdown */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {user.actions
                        .sort((a, b) => b.count - a.count)
                        .map((a) => (
                          <span
                            key={`${a.action}-${a.entity}`}
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[a.action] ?? 'bg-muted text-muted-foreground'}`}
                          >
                            <span className="capitalize">{a.action}</span>
                            <span className="opacity-70">{ENTITY_LABELS[a.entity] ?? a.entity}</span>
                            {a.count > 1 && <span className="font-bold">×{a.count}</span>}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
