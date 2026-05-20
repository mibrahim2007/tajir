'use server'

import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { db } from '@/db'
import { apPayments } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

export async function deleteApPaymentAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id } = parsed.data

  const payment = await db.select().from(apPayments).where(and(eq(apPayments.id, id), eq(apPayments.tenantId, tenantId))).limit(1).then((r) => r[0] ?? null)
  if (!payment) return { success: false, error: 'Payment not found', code: 'NOT_FOUND' }

  await db.delete(apPayments).where(and(eq(apPayments.id, id), eq(apPayments.tenantId, tenantId)))

  await createAuditEntry({ tenantId, userId: user.id, action: 'delete', entity: 'ap_payments', entityId: id, before: { supplierId: payment.supplierId, amount: payment.amount, pkrEquivalent: payment.pkrEquivalent, date: payment.date } })

  return { success: true, data: undefined }
}
