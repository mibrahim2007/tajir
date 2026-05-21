import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { InviteAssistantForm } from '@/app/settings/team/invite-assistant-form'
import { AssistantManagement } from '@/app/settings/team/assistant-management'

export default async function TeamSettingsPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const { data } = await admin
    .from('tenant_users')
    .select('id, user_id, role, is_active, tenant_id, username, created_at')
    .eq('tenant_id', tenantId)
    .eq('role', 'assistant')
    .limit(1)

  const assistantRow = data?.[0] ?? null

  let assistantEmail = ''
  if (assistantRow) {
    const { data: authUser } = await admin.auth.admin.getUserById(assistantRow.user_id)
    assistantEmail = authUser.user?.email ?? ''
  }

  const assistant = assistantRow
    ? {
        id: assistantRow.id,
        tenantId: assistantRow.tenant_id,
        userId: assistantRow.user_id,
        username: assistantRow.username,
        role: assistantRow.role as 'assistant',
        isActive: assistantRow.is_active,
        createdAt: new Date(assistantRow.created_at),
      }
    : null

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Team</h1>
      <p className="text-sm text-muted-foreground mb-8">Manage your assistant&apos;s access</p>

      {assistant ? (
        <AssistantManagement assistantEmail={assistantEmail} isActive={assistant.isActive} />
      ) : (
        <InviteAssistantForm />
      )}
    </div>
  )
}
