import { db } from '@/db'
import { auditLog } from '@/db/schema'

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
  await db.insert(auditLog).values({
    tenantId: params.tenantId,
    userId: params.userId,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    before: params.before ?? null,
    after: params.after ?? null,
  })
}
