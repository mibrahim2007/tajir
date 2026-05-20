'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { db } from '@/db'
import { apPayments } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'
import type { ApPayment } from '@/db/schema'

const schema = z.object({
  supplierId:         z.string().uuid('Invalid supplier'),
  amount:             z.coerce.number().positive('Amount must be positive'),
  currencyCode:       z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:       z.coerce.number().positive().default(1),
  date:               z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentMethodNote:  z.string().optional(),
})

export async function createApPaymentAction(
  input: unknown,
): Promise<ActionResult<ApPayment>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') {
    return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }
  }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { supplierId, amount, currencyCode, exchangeRate, date, paymentMethodNote } = parsed.data

  const pkrEquivalent = currencyCode === 'USD' ? amount * exchangeRate : amount

  const [payment] = await db
    .insert(apPayments)
    .values({
      tenantId,
      supplierId,
      amount: String(amount),
      currencyCode,
      pkrEquivalent: String(pkrEquivalent),
      paymentMethodNote: paymentMethodNote || null,
      date,
    })
    .returning()

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'create',
    entity: 'ap_payments',
    entityId: payment.id,
    after: { supplierId, amount, currencyCode, pkrEquivalent, date },
  })

  return { success: true, data: payment }
}
