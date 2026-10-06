'use server'

import { z } from 'zod'
import { documentDateSchema } from '@/lib/validation/document-date'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { nextDocumentSerial } from '@/lib/serials/next-serial'
import { receiptTenderLineSchema } from '@/lib/constants/tender-types'
import { checkDirectLines, receiptJournalLines, receiptLineRows } from '@/lib/accounting/receipt-gl'
import { glCreateFailed } from '@/lib/accounting/gl-failure'
import type { ActionResult } from '@/lib/types'


const schema = z.object({
  customerId:        z.string().uuid('Invalid customer'),
  amount:            z.coerce.number().positive('Amount must be positive').optional(),
  currencyCode:      z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:      z.coerce.number().positive().default(1),
  date:              documentDateSchema,
  paymentMethodNote: z.string().optional(),
  chequeNumber:      z.string().optional(),
  bankId:            z.string().uuid().optional(),
  moneyAccount:      z.enum(['cash_in_hand', 'cash_at_bank', 'post_dated_cheques']).default('cash_in_hand'),
  lines:             z.array(receiptTenderLineSchema).optional(),
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
  if (hasLines) {
    const directError = await checkDirectLines(admin, tenantId, lines!, currencyCode)
    if (directError) return { success: false, error: directError, code: 'VALIDATION_ERROR' }
  }
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
    const lineRows = receiptLineRows(tenantId, receipt.id, lines!)
    const { error: linesError } = await admin.from('ar_receipt_lines').insert(lineRows)
    if (linesError) {
      await admin.from('ar_receipts').delete().eq('id', receipt.id)
      return { success: false, error: 'Failed to save receipt lines', code: 'INTERNAL_ERROR' }
    }
  }

  // Auto-post GL: DR each money account (per tender type) or, for a direct
  // line, DR Accounts Payable for the supplier the customer paid; CR Accounts
  // Receivable for the customer. See lib/accounting/receipt-gl.ts.
  const journalLines = hasLines
    ? receiptJournalLines(lines!, rate, customerId, pkrEquivalent)
    : [
        { accountSystemKey: moneyAccount, debit: pkrEquivalent, credit: 0 },
        { accountSystemKey: 'accounts_receivable', debit: 0, credit: pkrEquivalent, customerId },
      ]

  const posted = await postJournalEntry({
    tenantId, date, description: `Customer Receipt — ${paymentMethodNote ?? ''}`, reference: serialNumber, sourceType: 'ar_receipt', sourceId: receipt.id, prefix: 'RC',
    lines: journalLines,
  })
  if (!posted.ok) {
    await admin.from("ar_receipts").delete().eq("id", receipt.id)
    return glCreateFailed(posted.message)
  }

  await createAuditEntry({ tenantId, userId: user.id, action: 'create', entity: 'ar_receipts', entityId: receipt.id, after: { customerId, amount, currencyCode, pkrEquivalent, date } })

  return { success: true, data: receipt }
}
