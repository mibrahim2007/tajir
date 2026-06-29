import { createAdminClient } from '@/lib/supabase/admin'

type CreateAuditEntryParams = {
  tenantId: string
  userId: string
  action: string
  entity: string
  entityId?: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
}

export async function createAuditEntry(params: CreateAuditEntryParams): Promise<void> {
  const admin = createAdminClient()
  await admin.from('audit_log').insert({
    tenant_id: params.tenantId,
    user_id: params.userId,
    action: params.action,
    entity: params.entity,
    entity_id: params.entityId,
    before: params.before ?? null,
    after: params.after ?? null,
  })
}
