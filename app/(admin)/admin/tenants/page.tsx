import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { formatPKTDate } from '@/lib/utils/dates'
import { EditTenantDialog } from './edit-tenant-dialog'

const statusColors: Record<string, string> = {
  active:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  grace_period: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  locked:       'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled:    'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400',
}

export default async function TenantsPage() {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: tenants } = await admin
    .from('tenants')
    .select('id, name, subscription_status, subscription_expires_at, created_at, tenant_users(count)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Tenants</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tenants?.length ?? 0} tenant{(tenants?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/admin/tenants/new">
          <Button className="min-h-[44px]">New Tenant</Button>
        </Link>
      </div>

      {(!tenants || tenants.length === 0) ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No tenants yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Users</th>
                  <th className="text-left px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 w-36" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {tenants.map((t) => {
                  const userCount = (t.tenant_users as { count: number }[])?.[0]?.count ?? 0
                  return (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{t.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[t.subscription_status] ?? ''}`}>
                          {t.subscription_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {userCount}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatPKTDate(new Date(t.created_at))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <EditTenantDialog tenant={t} />
                          <Link href={`/admin/tenants/${t.id}/users`}>
                            <Button variant="outline" size="sm" className="min-h-[36px]">
                              Users
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
