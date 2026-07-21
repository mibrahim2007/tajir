'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { repostJournalEntry } from '@/lib/accounting/repost-journal-entry'
import { aggregateMoneyLegs, type TenderType, tenderLineSchema } from '@/lib/constants/tender-types'
import { glEditFailed } from '@/lib/accounting/gl-failure'
import { verifyEndorsable, markEndorsed, releaseEndorsement, endorsementRefsFrom, type EndorsementRef } from '@/lib/pdc/endorsement'
import type { PdcSource } from '@/lib/pdc/sources'
import type { ActionResult } from '@/lib/types'


const schema = z.object({
  id:                z.string().uuid(),
  currencyCode:      z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:      z.coerce.number().positive().default(1),
  date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethodNote: z.string().optional(),
  lines:             z.array(tenderLineSchema).min(1, 'Add at least one tender line'),
})

export async function editApPaymentAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, currencyCode, exchangeRate, date, paymentMethodNote, lines } = parsed.data
  const rate = currencyCode === 'USD' ? exchangeRate : 1

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('ap_payments')
    .select('supplier_id, serial_number, amount, pkr_equivalent, date')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!existing) return { success: false, error: 'Payment not found', code: 'NOT_FOUND' }

  // Reconcile handed-on cheques against what this payment held before. Lines
  // are replaced wholesale below, so without this a cheque dropped from the
  // payment would stay 'endorsed' with nothing behind it, and a newly added
  // one would never be consumed at all.
  const { data: oldLines } = await admin
    .from('ap_payment_lines')
    .select('endorsed_from_source, endorsed_from_line_id')
    .eq('payment_id', id)
    .eq('tenant_id', tenantId)

  const refKey = (r: EndorsementRef) => `${r.source}:${r.lineId}`
  const heldBefore = new Set(endorsementRefsFrom(oldLines ?? []).map(refKey))

  const wanted: EndorsementRef[] = []
  for (const l of lines) {
    if (!l.endorsedFromLineId || !l.endorsedFromSource) continue
    const ref = { source: l.endorsedFromSource as PdcSource, lineId: l.endorsedFromLineId }
    const check = await verifyEndorsable(tenantId, ref, heldBefore.has(refKey(ref)))
    if (!check.ok) return { success: false, error: check.message, code: 'VALIDATION_ERROR' }
    l.amount        = Number(check.cheque.amount)
    l.chequeNumber  = check.cheque.cheque_number ?? l.chequeNumber
    l.chequeDueDate = check.cheque.cheque_due_date ?? l.chequeDueDate
    wanted.push(ref)
  }
  const wantedKeys = new Set(wanted.map(refKey))

  // Totalled only now: an endorsed line's amount comes from its cheque, not
  // from whatever the form submitted.
  const amount = lines.reduce((s, l) => s + l.amount, 0)
  const pkrEquivalent = amount * rate

  const { error } = await admin
    .from('ap_payments')
    .update({ amount, currency_code: currencyCode, pkr_equivalent: pkrEquivalent, date, payment_method_note: paymentMethodNote ?? null, cheque_number: null, bank_id: null })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update payment', code: 'INTERNAL_ERROR' }

  // Replace tender lines
  await admin.from('ap_payment_lines').delete().eq('payment_id', id).eq('tenant_id', tenantId)
  const lineRows = lines.map((l, i) => ({
    tenant_id: tenantId, payment_id: id, line_no: i + 1,
    transaction_type: l.transactionType, cheque_number: l.chequeNumber || null,
    // Was omitted here while the create path set it, so every edit silently
    // wiped the due date off its PDC lines.
    cheque_due_date: l.chequeDueDate || null,
    bank_id: l.bankId ?? null, amount: l.amount,
    endorsed_from_source:  l.endorsedFromSource || null,
    endorsed_from_line_id: l.endorsedFromLineId || null,
  }))
  await admin.from('ap_payment_lines').insert(lineRows)

  // Consume cheques newly added to this payment, and hand back any it dropped.
  for (const ref of wanted) {
    if (!heldBefore.has(refKey(ref))) await markEndorsed(tenantId, ref)
  }
  for (const ref of endorsementRefsFrom(oldLines ?? [])) {
    if (!wantedKeys.has(refKey(ref))) await releaseEndorsement(tenantId, ref)
  }

  // Re-post GL. The helper snapshots the previous entry first, so a failed
  // post restores it instead of leaving this document with no ledger entry.
  const moneyLegs = aggregateMoneyLegs(lines.map((l) => ({ transactionType: l.transactionType as TenderType, amount: l.amount })), rate, 'out')
  const posted = await repostJournalEntry({
    tenantId, date, description: `Supplier Payment — ${paymentMethodNote ?? ''}`, reference: existing.serial_number ?? undefined, sourceType: 'ap_payment', sourceId: id, prefix: 'PM',
    lines: [
      { accountSystemKey: 'accounts_payable', debit: pkrEquivalent, credit: 0, supplierId: existing.supplier_id },
      ...moneyLegs.map((leg) => ({ accountSystemKey: leg.accountSystemKey, debit: 0, credit: leg.pkr })),
    ],
  })
  if (!posted.ok) return glEditFailed(posted.message)

  await createAuditEntry({ tenantId, userId: user.id, action: 'update', entity: 'ap_payments', entityId: id, before: { amount: existing.amount, pkrEquivalent: existing.pkr_equivalent, date: existing.date }, after: { amount, pkrEquivalent, date } })

  return { success: true, data: undefined }
}
