'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { db } from '@/db'
import { arReceipts } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'
import type { ArReceipt } from '@/db/schema'

const schema = z.object({
  customerId: z.string().uuid('Invalid customer'),
  amount: z.coerce.number().positive('Amount must be positive'),
  currencyCode: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.coerce.number().positive().default(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentMethodNote: z.string().optional(),
})

export async function createArReceiptAction(input: unknown): Promise<ActionResult<ArReceipt>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { customerId, amount, currencyCode, exchangeRate, date, paymentMethodNote } = parsed.data
  const pkrEquivalent = currencyCode === 'USD' ? amount * exchangeRate : amount

  const [receipt] = await db.insert(arReceipts).values({
    tenantId, customerId,
    amount: String(amount),
    currencyCode,
    pkrEquivalent: String(pkrEquivalent),
    paymentMethodNote: paymentMethodNote || null,
    date,
  }).returning()

  await createAuditEntry({ tenantId, userId: user.id, action: 'create', entity: 'ar_receipts', entityId: receipt.id, after: { customerId, amount, currencyCode, pkrEquivalent, date } })

  return { success: true, data: receipt }
}
