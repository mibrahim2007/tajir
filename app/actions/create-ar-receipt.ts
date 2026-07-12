'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { nextDocumentSerial } from '@/lib/serials/next-serial'
import { aggregateMoneyLegs, type TenderType } from '@/lib/constants/tender-types'
import type { ActionResult } from '@/lib/types'

const lineSchema = z.object({
  transactionType: z.enum(['cash', 'pdc', 'online']),
  chequeNumber:    z.string().trim().optional().nullable(),
  bankId:          z.string().uuid().optional().nullable(),
  amount:          z.coerce.number().positive('Line amount must be positive'),
})

const schema = z.object({
  customerId:        z.string().uuid('Invalid customer'),
  amount:            z.coerce.number().positive('Amount must be positive').optional(),
  currencyCode:      z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:      z.coerce.number().positive().default(1),
  date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentMethodNote: z.string().optional(),
  chequeNumber:      z.string().optional(),
  bankId:            z.string().uuid().optional(),
  moneyAccount:      z.enum(['cash_in_hand', 'cash_at_bank', 'post_dated_cheques']).default('cash_in_hand'),
  lines:             z.array(lineSchema).optional(),
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

  const { customerId, currencyCode, exchangeRate, date, paymentMethodNote, chequeNumber, bankId, moneyAccount, lines } = parsed.data
  const rate = currencyCode === 'USD' ? exchangeRate : 1

  // Total is the sum of tender lines when provided, else the single amount.
  const hasLines = !!lines && lines.length > 0
  const amount = hasLines ? lines!.reduce((s, l) => s + l.amount, 0) : (parsed.data.amount ?? 0)
  if (amount <= 0) return { success: false, error: 'Amount must be positive', code: 'VALIDATION_ERROR' }
  const pkrEquivalent = amount * rate

  const admin = createAdminClient()
  const serialNumber = await nextDocumentSerial(admin, tenantId, 'ar_receipt', date)
  const { data: receipt, error } = await admin
    .from('ar_receipts')
    .insert({
      tenant_id: tenantId,
      serial_number: serialNumber,
      customer_id: customerId,
      amount,
      currency_code: currencyCode,
      pkr_equivalent: pkrEquivalent,
      payment_method_note: paymentMethodNote || null,
      // For lined receipts the tender detail lives in ar_receipt_lines.
      cheque_number: hasLines ? null : (chequeNumber || null),
      bank_id:       hasLines ? null : (bankId ?? null),
      date,
    })
    .select('id')
    .single()

  if (error || !receipt) {
    return { success: false, error: 'Failed to record receipt', code: 'INTERNAL_ERROR' }
  }

  // Persist tender detail lines
  if (hasLines) {
    const lineRows = lines!.map((l, i) => ({
      tenant_id:        tenantId,
      receipt_id:       receipt.id,
      line_no:          i + 1,
      transaction_type: l.transactionType,
      cheque_number:    l.chequeNumber || null,
      bank_id:          l.bankId ?? null,
      amount:           l.amount,
    }))
    const { error: linesError } = await admin.from('ar_receipt_lines').insert(lineRows)
    if (linesError) {
      await admin.from('ar_receipts').delete().eq('id', receipt.id)
      return { success: false, error: 'Failed to save receipt lines', code: 'INTERNAL_ERROR' }
    }
  }

  // Auto-post GL: DR each money account (per tender type), CR Accounts Receivable.
  const moneyLegs = hasLines
    ? aggregateMoneyLegs(lines!.map((l) => ({ transactionType: l.transactionType as TenderType, amount: l.amount })), rate)
    : [{ accountSystemKey: moneyAccount, pkr: pkrEquivalent }]

  await postJournalEntry({
    tenantId, date, description: `Customer Receipt — ${paymentMethodNote ?? ''}`, reference: serialNumber, sourceType: 'ar_receipt', sourceId: receipt.id, prefix: 'RC',
    lines: [
      ...moneyLegs.map((leg) => ({ accountSystemKey: leg.accountSystemKey, debit: leg.pkr, credit: 0 })),
      { accountSystemKey: 'accounts_receivable', debit: 0, credit: pkrEquivalent, customerId },
    ],
  })

  await createAuditEntry({ tenantId, userId: user.id, action: 'create', entity: 'ar_receipts', entityId: receipt.id, after: { customerId, amount, currencyCode, pkrEquivalent, date } })

  return { success: true, data: receipt }
}
