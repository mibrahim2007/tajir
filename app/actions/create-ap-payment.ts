'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  supplierId:        z.string().uuid('Invalid supplier'),
  amount:            z.coerce.number().positive('Amount must be positive'),
  currencyCode:      z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:      z.coerce.number().positive().default(1),
  date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentMethodNote: z.string().optional(),
  chequeNumber:      z.string().optional(),
  bankId:            z.string().uuid().optional(),
  moneyAccount:      z.enum(['cash_in_hand', 'cash_at_bank', 'post_dated_cheques']).default('cash_in_hand'),
})

export async function createApPaymentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, tenantId } = await requireAuth()

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { supplierId, amount, currencyCode, exchangeRate, date, paymentMethodNote, chequeNumber, bankId, moneyAccount } = parsed.data
  const pkrEquivalent = currencyCode === 'USD' ? amount * exchangeRate : amount

  const admin = createAdminClient()
  const { data: payment, error } = await admin
    .from('ap_payments')
    .insert({
      tenant_id: tenantId,
      supplier_id: supplierId,
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

  if (error || !payment) {
    return { success: false, error: 'Failed to record payment', code: 'INTERNAL_ERROR' }
  }

  // Auto-post GL: DR Accounts Payable, CR the selected money account (Cash / Bank / PDC)
  await postJournalEntry({
    tenantId, date, description: `Supplier Payment — ${paymentMethodNote ?? ''}`, sourceType: 'ap_payment', sourceId: payment.id, prefix: 'PM',
    lines: [
      { accountSystemKey: 'accounts_payable', debit: pkrEquivalent, credit: 0, supplierId },
      { accountSystemKey: moneyAccount,       debit: 0, credit: pkrEquivalent },
    ],
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create', entity: 'ap_payments', entityId: payment.id,
    after: { supplierId, amount, currencyCode, pkrEquivalent, date },
  })

  return { success: true, data: payment }
}
