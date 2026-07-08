import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.types'

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
    // Audit snapshots are arbitrary JSON-serializable objects; the compiler
    // can't prove Record<string, unknown> is Json, so assert it at the boundary.
    before: (params.before ?? null) as Json,
    after: (params.after ?? null) as Json,
  })
}
