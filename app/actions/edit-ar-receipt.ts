'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { aggregateMoneyLegs, type TenderType } from '@/lib/constants/tender-types'
import type { ActionResult } from '@/lib/types'

const lineSchema = z.object({
  transactionType: z.enum(['cash', 'pdc', 'online']),
  chequeNumber:    z.string().trim().optional().nullable(),
  bankId:          z.string().uuid().optional().nullable(),
  amount:          z.coerce.number().positive('Line amount must be positive'),
})

const schema = z.object({
  id:                z.string().uuid(),
  currencyCode:      z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:      z.coerce.number().positive().default(1),
  date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethodNote: z.string().optional(),
  lines:             z.array(lineSchema).min(1, 'Add at least one tender line'),
})

export async function editArReceiptAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, currencyCode, exchangeRate, date, paymentMethodNote, lines } = parsed.data
  const rate = currencyCode === 'USD' ? exchangeRate : 1
  const amount = lines.reduce((s, l) => s + l.amount, 0)
  const pkrEquivalent = amount * rate

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('ar_receipts')
    .select('customer_id, serial_number, amount, pkr_equivalent, date')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!existing) return { success: false, error: 'Receipt not found', code: 'NOT_FOUND' }

  const { error } = await admin
    .from('ar_receipts')
    .update({ amount, currency_code: currencyCode, pkr_equivalent: pkrEquivalent, date, payment_method_note: paymentMethodNote ?? null, cheque_number: null, bank_id: null })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update receipt', code: 'INTERNAL_ERROR' }

  // Replace tender lines
  await admin.from('ar_receipt_lines').delete().eq('receipt_id', id).eq('tenant_id', tenantId)
  const lineRows = lines.map((l, i) => ({
    tenant_id: tenantId, receipt_id: id, line_no: i + 1,
    transaction_type: l.transactionType, cheque_number: l.chequeNumber || null, bank_id: l.bankId ?? null, amount: l.amount,
  }))
  await admin.from('ar_receipt_lines').insert(lineRows)

  // Re-post GL: reuse the original voucher number, remove the old entry, post fresh.
  const { data: oldEntry } = await admin
    .from('tajir_journal_entries')
    .select('id, voucher_number')
    .eq('tenant_id', tenantId)
    .eq('source_type', 'ar_receipt')
    .eq('source_id', id)
    .maybeSingle()

  if (oldEntry) await admin.from('tajir_journal_entries').delete().eq('id', oldEntry.id)

  const moneyLegs = aggregateMoneyLegs(lines.map((l) => ({ transactionType: l.transactionType as TenderType, amount: l.amount })), rate)
  await postJournalEntry({
    tenantId, date, description: `Customer Receipt — ${paymentMethodNote ?? ''}`, reference: existing.serial_number ?? undefined, sourceType: 'ar_receipt', sourceId: id, prefix: 'RC',
    voucherNumber: oldEntry?.voucher_number ?? undefined,
    lines: [
      ...moneyLegs.map((leg) => ({ accountSystemKey: leg.accountSystemKey, debit: leg.pkr, credit: 0 })),
      { accountSystemKey: 'accounts_receivable', debit: 0, credit: pkrEquivalent, customerId: existing.customer_id },
    ],
  })

  await createAuditEntry({ tenantId, userId: user.id, action: 'update', entity: 'ar_receipts', entityId: id, before: { amount: existing.amount, pkrEquivalent: existing.pkr_equivalent, date: existing.date }, after: { amount, pkrEquivalent, date } })

  return { success: true, data: undefined }
}
