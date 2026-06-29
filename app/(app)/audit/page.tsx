import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKTDateTime } from '@/lib/utils/dates'

const PAGE_SIZE = 50

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const { tenantId, role } = await requireAuth()

  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const params = await searchParams
  const filterEntity = typeof params.entity === 'string' ? params.entity : undefined
  const page = typeof params.page === 'string' ? Math.max(1, parseInt(params.page, 10) || 1) : 1

  const admin = createAdminClient()
  let query = admin.from('audit_log').select('id, created_at, action, entity, before, after').eq('tenant_id', tenantId)
  if (filterEntity) query = query.eq('entity', filterEntity)

  const { data: rawEntries } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  const entries = rawEntries ?? []

  const ENTITIES = ['inventory_lots', 'suppliers', 'purchase_orders', 'ap_payments', 'tajir_customers', 'sales_orders', 'ar_receipts', 'customer_price_lists', 'tenant_users']

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Audit Trail</h1>
        <p className="text-sm text-muted-foreground mt-1">Every change to your account, in reverse chronological order.</p>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        <a href="/audit" className={`text-sm px-3 py-1.5 rounded-md border min-h-[44px] flex items-center ${!filterEntity ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>All</a>
        {ENTITIES.map((e) => (
          <a key={e} href={`/audit?entity=${e}`} className={`text-sm px-3 py-1.5 rounded-md border min-h-[44px] flex items-center ${filterEntity === e ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
            {e.replace(/_/g, ' ')}
          </a>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No audit entries yet.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Timestamp (PKT)</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Action</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Entity</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Before</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">After</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatPKTDateTime(new Date(entry.created_at))}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        entry.action === 'create' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        entry.action === 'delete' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{entry.entity}</td>
                    <td className="px-4 py-3 max-w-xs">
                      {entry.before ? (
                        <code className="text-xs bg-muted rounded px-1.5 py-0.5 block truncate">
                          {JSON.stringify(entry.before)}
                        </code>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {entry.after ? (
                        <code className="text-xs bg-muted rounded px-1.5 py-0.5 block truncate">
                          {JSON.stringify(entry.after)}
                        </code>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {entries.length === PAGE_SIZE && (
        <div className="mt-3 text-center">
          <a href={`/audit?page=${page + 1}${filterEntity ? `&entity=${filterEntity}` : ''}`} className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4">
            Next page →
          </a>
        </div>
      )}
    </div>
  )
}
