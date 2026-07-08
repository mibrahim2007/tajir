'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  customerId:        z.string().uuid('Invalid customer'),
  amount:            z.coerce.number().positive('Amount must be positive'),
  currencyCode:      z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:      z.coerce.number().positive().default(1),
  date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentMethodNote: z.string().optional(),
  chequeNumber:      z.string().optional(),
  bankId:            z.string().uuid().optional(),
})

export async function createArReceiptAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, tenantId } = await requireAuth()

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { customerId, amount, currencyCode, exchangeRate, date, paymentMethodNote, chequeNumber, bankId } = parsed.data
  const pkrEquivalent = currencyCode === 'USD' ? amount * exchangeRate : amount

  const admin = createAdminClient()
  const { data: receipt, error } = await admin
    .from('ar_receipts')
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      amount: amount,
      currency_code: currencyCode,
      pkr_equivalent: pkrEquivalent,
      payment_method_note: paymentMethodNote || null,
      cheque_number: chequeNumber || null,
      bank_id: bankId ?? null,
      date,
    })
    .select('id')
    .single()

  if (error || !receipt) {
    return { success: false, error: 'Failed to record receipt', code: 'INTERNAL_ERROR' }
  }

  // Auto-post GL: DR Cash in Hand, CR Accounts Receivable
  await postJournalEntry({
    tenantId, date, description: `Customer Receipt — ${paymentMethodNote ?? ''}`, sourceType: 'ar_receipt', sourceId: receipt.id, prefix: 'RC',
    lines: [
      { accountSystemKey: 'cash_in_hand',        debit: pkrEquivalent, credit: 0 },
      { accountSystemKey: 'accounts_receivable',  debit: 0, credit: pkrEquivalent, customerId },
    ],
  })

  await createAuditEntry({ tenantId, userId: user.id, action: 'create', entity: 'ar_receipts', entityId: receipt.id, after: { customerId, amount, currencyCode, pkrEquivalent, date } })

  return { success: true, data: receipt }
}
