'use server'

import { z } from 'zod'
import { documentDateSchema } from '@/lib/validation/document-date'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { repostJournalEntry } from '@/lib/accounting/repost-journal-entry'
import { receiptTenderLineSchema } from '@/lib/constants/tender-types'
import { checkDirectLines, receiptJournalLines, receiptLineRows } from '@/lib/accounting/receipt-gl'
import { glEditFailed } from '@/lib/accounting/gl-failure'
import type { ActionResult } from '@/lib/types'


const schema = z.object({
  id:                z.string().uuid(),
  currencyCode:      z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:      z.coerce.number().positive().default(1),
  date:              documentDateSchema,
  paymentMethodNote: z.string().optional(),
  lines:             z.array(receiptTenderLineSchema).min(1, 'Add at least one tender line'),
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

  const directError = await checkDirectLines(admin, tenantId, lines, currencyCode)
  if (directError) return { success: false, error: directError, code: 'VALIDATION_ERROR' }

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
  // Built by the shared helper so edit writes every column create does —
  // including cheque_due_date (see 0062) and the direct-payment supplier.
  const lineRows = receiptLineRows(tenantId, id, lines)
  await admin.from('ar_receipt_lines').insert(lineRows)

  // Re-post GL. The helper snapshots the previous entry first, so a failed
  // post restores it instead of leaving this document with no ledger entry.
  const posted = await repostJournalEntry({
    tenantId, date, description: `Customer Receipt — ${paymentMethodNote ?? ''}`, reference: existing.serial_number ?? undefined, sourceType: 'ar_receipt', sourceId: id, prefix: 'RC',
    lines: receiptJournalLines(lines, rate, existing.customer_id, pkrEquivalent),
  })
  if (!posted.ok) return glEditFailed(posted.message)

  await createAuditEntry({ tenantId, userId: user.id, action: 'update', entity: 'ar_receipts', entityId: id, before: { amount: existing.amount, pkrEquivalent: existing.pkr_equivalent, date: existing.date }, after: { amount, pkrEquivalent, date } })

  return { success: true, data: undefined }
}
