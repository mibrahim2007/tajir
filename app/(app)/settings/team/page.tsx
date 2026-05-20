import { and, eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/db'
import { tenantUsers } from '@/db/schema'
import { InviteAssistantForm } from '@/app/settings/team/invite-assistant-form'
import { AssistantManagement } from '@/app/settings/team/assistant-management'

export default async function TeamSettingsPage() {
  const { tenantId } = await requireAuth()

  const assistant = await db
    .select()
    .from(tenantUsers)
    .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.role, 'assistant')))
    .limit(1)
    .then((rows) => rows[0] ?? null)

  let assistantEmail = ''
  if (assistant) {
    const admin = createAdminClient()
    const { data } = await admin.auth.admin.getUserById(assistant.userId)
    assistantEmail = data.user?.email ?? ''
  }

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
