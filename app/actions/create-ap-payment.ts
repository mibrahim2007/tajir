'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { nextDocumentSerial } from '@/lib/serials/next-serial'
import { aggregateMoneyLegs, type TenderType, tenderLineSchema } from '@/lib/constants/tender-types'
import { glCreateFailed } from '@/lib/accounting/gl-failure'
import type { ActionResult } from '@/lib/types'


const schema = z.object({
  supplierId:        z.string().uuid('Invalid supplier'),
  amount:            z.coerce.number().positive('Amount must be positive').optional(),
  currencyCode:      z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:      z.coerce.number().positive().default(1),
  date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentMethodNote: z.string().optional(),
  chequeNumber:      z.string().optional(),
  bankId:            z.string().uuid().optional(),
  moneyAccount:      z.enum(['cash_in_hand', 'cash_at_bank', 'post_dated_cheques']).default('cash_in_hand'),
  lines:             z.array(tenderLineSchema).optional(),
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

  const { supplierId, currencyCode, exchangeRate, date, paymentMethodNote, chequeNumber, bankId, moneyAccount, lines } = parsed.data
  const rate = currencyCode === 'USD' ? exchangeRate : 1

  const hasLines = !!lines && lines.length > 0
  const amount = hasLines ? lines!.reduce((s, l) => s + l.amount, 0) : (parsed.data.amount ?? 0)
  if (amount <= 0) return { success: false, error: 'Amount must be positive', code: 'VALIDATION_ERROR' }
  const pkrEquivalent = amount * rate

  const admin = createAdminClient()
  const serialNumber = await nextDocumentSerial(admin, tenantId, 'ap_payment', date)
  const { data: payment, error } = await admin
    .from('ap_payments')
    .insert({
      tenant_id: tenantId,
      serial_number: serialNumber,
      supplier_id: supplierId,
      amount,
      currency_code: currencyCode,
      pkr_equivalent: pkrEquivalent,
      payment_method_note: paymentMethodNote || null,
      cheque_number: hasLines ? null : (chequeNumber || null),
      bank_id:       hasLines ? null : (bankId ?? null),
      date,
    })
    .select('id')
    .single()

  if (error || !payment) {
    return { success: false, error: 'Failed to record payment', code: 'INTERNAL_ERROR' }
  }

  if (hasLines) {
    const lineRows = lines!.map((l, i) => ({
      tenant_id:        tenantId,
      payment_id:       payment.id,
      line_no:          i + 1,
      transaction_type: l.transactionType,
      cheque_number:    l.chequeNumber || null,
    cheque_due_date:  l.chequeDueDate || null,
      bank_id:          l.bankId ?? null,
      amount:           l.amount,
    }))
    const { error: linesError } = await admin.from('ap_payment_lines').insert(lineRows)
    if (linesError) {
      await admin.from('ap_payments').delete().eq('id', payment.id)
      return { success: false, error: 'Failed to save payment lines', code: 'INTERNAL_ERROR' }
    }
  }

  // Auto-post GL: DR Accounts Payable, CR each money account (per tender type).
  const moneyLegs = hasLines
    ? aggregateMoneyLegs(lines!.map((l) => ({ transactionType: l.transactionType as TenderType, amount: l.amount })), rate)
    : [{ accountSystemKey: moneyAccount, pkr: pkrEquivalent }]

  const posted = await postJournalEntry({
    tenantId, date, description: `Supplier Payment — ${paymentMethodNote ?? ''}`, reference: serialNumber, sourceType: 'ap_payment', sourceId: payment.id, prefix: 'PM',
    lines: [
      { accountSystemKey: 'accounts_payable', debit: pkrEquivalent, credit: 0, supplierId },
      ...moneyLegs.map((leg) => ({ accountSystemKey: leg.accountSystemKey, debit: 0, credit: leg.pkr })),
    ],
  })
  // Without its GL entry the payment would be invisible to the ledger, so roll
  // the document back rather than report a success that the books don't show.
  if (!posted.ok) {
    await admin.from('ap_payments').delete().eq('id', payment.id)
    return glCreateFailed(posted.message)
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create', entity: 'ap_payments', entityId: payment.id,
    after: { supplierId, amount, currencyCode, pkrEquivalent, date },
  })

  return { success: true, data: payment }
}
