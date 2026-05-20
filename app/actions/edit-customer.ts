'use server'

import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { db } from '@/db'
import { tajirCustomers } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  id:   z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
})

export async function editCustomerAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, name } = parsed.data

  const existing = await db.select().from(tajirCustomers).where(and(eq(tajirCustomers.id, id), eq(tajirCustomers.tenantId, tenantId))).limit(1).then((r) => r[0] ?? null)
  if (!existing) return { success: false, error: 'Customer not found', code: 'NOT_FOUND' }

  await db.update(tajirCustomers).set({ name }).where(and(eq(tajirCustomers.id, id), eq(tajirCustomers.tenantId, tenantId)))

  await createAuditEntry({ tenantId, userId: user.id, action: 'update', entity: 'tajir_customers', entityId: id, before: { name: existing.name }, after: { name } })

  return { success: true, data: undefined }
}
