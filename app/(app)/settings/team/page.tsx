import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { InviteAssistantForm } from '@/app/settings/team/invite-assistant-form'
import { TeamMemberList } from '@/app/settings/team/team-member-list'
import type { TeamMember } from '@/app/settings/team/team-member-list'
import type { Role } from '@/db/schema'
import { parseTenantFeatures, parseUserPermissions, type ModuleKey } from '@/lib/modules'

export default async function TeamSettingsPage() {
  const { user, tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: rows }, { data: tenant }] = await Promise.all([
    admin
      .from('tenant_users')
      .select('id, user_id, role, is_active, permissions')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
    admin
      .from('tenants')
      .select('features')
      .eq('id', tenantId)
      .single(),
  ])

  const tenantModules = [
    ...parseTenantFeatures((tenant as { features?: unknown } | null)?.features),
  ] as ModuleKey[]

  const members: TeamMember[] = await Promise.all(
    (rows ?? []).map(async (row) => {
      const { data: authUser } = await admin.auth.admin.getUserById(row.user_id)
      return {
        id: row.id,
        userId: row.user_id,
        email: authUser.user?.email ?? row.user_id,
        role: row.role as Role,
        isActive: row.is_active,
        permissions: parseUserPermissions(row.permissions) !== null
          ? [...(parseUserPermissions(row.permissions) ?? [])] as ModuleKey[]
          : null,
      }
    }),
  )

  members.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'owner' ? -1 : 1
    return a.email.localeCompare(b.email)
  })

  return (
    <div className="p-6 max-w-lg mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage who has access to your account and what they can do.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Members ({members.length})
        </h2>
        <TeamMemberList members={members} currentUserId={user.id} tenantModules={tenantModules} />
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Add Member
        </h2>
        <InviteAssistantForm />
      </section>
    </div>
  )
}
