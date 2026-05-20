'use server'

import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { db } from '@/db'
import { arReceipts } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  id:                z.string().uuid(),
  amount:            z.coerce.number().positive(),
  currencyCode:      z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:      z.coerce.number().positive().default(1),
  date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethodNote: z.string().optional(),
})

export async function editArReceiptAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, amount, currencyCode, exchangeRate, date, paymentMethodNote } = parsed.data
  const pkrEquivalent = currencyCode === 'USD' ? amount * exchangeRate : amount

  const existing = await db.select().from(arReceipts).where(and(eq(arReceipts.id, id), eq(arReceipts.tenantId, tenantId))).limit(1).then((r) => r[0] ?? null)
  if (!existing) return { success: false, error: 'Receipt not found', code: 'NOT_FOUND' }

  await db.update(arReceipts).set({ amount: String(amount), currencyCode, pkrEquivalent: String(pkrEquivalent), date, paymentMethodNote: paymentMethodNote ?? null })
    .where(and(eq(arReceipts.id, id), eq(arReceipts.tenantId, tenantId)))

  await createAuditEntry({ tenantId, userId: user.id, action: 'update', entity: 'ar_receipts', entityId: id, before: { amount: existing.amount, pkrEquivalent: existing.pkrEquivalent, date: existing.date }, after: { amount, pkrEquivalent, date } })

  return { success: true, data: undefined }
}
