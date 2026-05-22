import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { DeleteButton } from '@/components/delete-button'
import { formatPKTDate } from '@/lib/utils/dates'
import { deleteTenantUserAction } from '@/app/actions/admin/delete-tenant-user'
import { AddUserDialog } from './add-user-dialog'
import { EditUserDialog } from './edit-user-dialog'

type Props = { params: Promise<{ id: string }> }

export default async function TenantUsersPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params
  const admin = createAdminClient()

  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name, subscription_status')
    .eq('id', id)
    .single()

  if (!tenant) notFound()

  const { data: tuRows } = await admin
    .from('tenant_users')
    .select('id, user_id, role, is_active, created_at')
    .eq('tenant_id', id)
    .order('created_at', { ascending: true })

  // Fetch all auth users and build a map by id
  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const authMap = new Map(authUsers.map((u) => [u.id, u]))

  const users = (tuRows ?? []).map((tu) => {
    const auth = authMap.get(tu.user_id)
    return {
      tuId:        tu.id,
      userId:      tu.user_id,
      email:       auth?.email ?? '—',
      role:        tu.role,
      isActive:    tu.is_active,
      lastSignIn:  auth?.last_sign_in_at ?? null,
      createdAt:   tu.created_at,
    }
  })

  const statusColors: Record<string, string> = {
    active:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    grace_period: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    locked:       'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    cancelled:    'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400',
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-1">
        <Link href="/admin/tenants">
          <Button variant="ghost" size="sm" className="min-h-[36px]">← Tenants</Button>
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{tenant.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[tenant.subscription_status] ?? ''}`}>
              {tenant.subscription_status.replace('_', ' ')}
            </span>
            <p className="text-sm text-muted-foreground">{users.length} user{users.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <AddUserDialog tenantId={id} />
      </div>

      {users.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No users yet. Add the first user above.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Role</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Last Sign In</th>
                  <th className="text-left px-4 py-3 font-medium">Added</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.tuId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{u.email}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{u.role}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {u.lastSignIn ? formatPKTDate(new Date(u.lastSignIn)) : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatPKTDate(new Date(u.createdAt))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <EditUserDialog user={{ userId: u.userId, tenantId: id, email: u.email, role: u.role, isActive: u.isActive }} />
                        <DeleteButton
                          description={`Delete ${u.email}? They will lose all access immediately.`}
                          onDelete={deleteTenantUserAction.bind(null, { userId: u.userId })}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
