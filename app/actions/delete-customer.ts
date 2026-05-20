'use server'

import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { db } from '@/db'
import { tajirCustomers } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

export async function deleteCustomerAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id } = parsed.data

  const customer = await db.select().from(tajirCustomers).where(and(eq(tajirCustomers.id, id), eq(tajirCustomers.tenantId, tenantId))).limit(1).then((r) => r[0] ?? null)
  if (!customer) return { success: false, error: 'Customer not found', code: 'NOT_FOUND' }

  await db.delete(tajirCustomers).where(and(eq(tajirCustomers.id, id), eq(tajirCustomers.tenantId, tenantId)))

  await createAuditEntry({ tenantId, userId: user.id, action: 'delete', entity: 'tajir_customers', entityId: id, before: { name: customer.name, openingBalance: customer.openingBalance, openingBalancePkrEquivalent: customer.openingBalancePkrEquivalent } })

  return { success: true, data: undefined }
}
