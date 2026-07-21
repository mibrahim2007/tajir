'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { repostJournalEntry } from '@/lib/accounting/repost-journal-entry'
import { aggregateMoneyLegs, type TenderType, tenderLineSchema } from '@/lib/constants/tender-types'
import { glEditFailed } from '@/lib/accounting/gl-failure'
import type { ActionResult } from '@/lib/types'


const schema = z.object({
  id:           z.string().uuid(),
  currencyCode: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.coerce.number().positive().default(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes:        z.string().optional(),
  lines:        z.array(tenderLineSchema).min(1, 'Add at least one tender line'),
})

export async function editSupplierRefundAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, currencyCode, exchangeRate, date, notes, lines } = parsed.data
  const rate = currencyCode === 'USD' ? exchangeRate : 1
  const amount = lines.reduce((s, l) => s + l.amount, 0)
  const pkrEquivalent = amount * rate

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('supplier_refunds')
    .select('supplier_id, serial_number, amount, pkr_equivalent, date')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!existing) return { success: false, error: 'Refund not found', code: 'NOT_FOUND' }

  const { error } = await admin
    .from('supplier_refunds')
    .update({ amount, currency_code: currencyCode, exchange_rate: exchangeRate, pkr_equivalent: pkrEquivalent, date, payment_method: null, notes: notes ?? null })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update refund', code: 'INTERNAL_ERROR' }

  // Replace tender lines
  await admin.from('supplier_refund_lines').delete().eq('refund_id', id).eq('tenant_id', tenantId)
  const lineRows = lines.map((l, i) => ({
    tenant_id: tenantId, refund_id: id, line_no: i + 1,
    transaction_type: l.transactionType, cheque_number: l.chequeNumber || null, bank_id: l.bankId ?? null, amount: l.amount,
  }))
  await admin.from('supplier_refund_lines').insert(lineRows)

  // Re-post GL. The helper snapshots the previous entry first, so a failed
  // post restores it instead of leaving this document with no ledger entry.
  const moneyLegs = aggregateMoneyLegs(lines.map((l) => ({ transactionType: l.transactionType as TenderType, amount: l.amount })), rate, 'in')
  const posted = await repostJournalEntry({
    tenantId, date, description: 'Supplier Refund', reference: existing.serial_number ?? undefined,
    sourceType: 'supplier_refund', sourceId: id, prefix: 'SR',
    lines: [
      ...moneyLegs.map((leg) => ({ accountSystemKey: leg.accountSystemKey, debit: leg.pkr, credit: 0 })),
      { accountSystemKey: 'accounts_payable', debit: 0, credit: pkrEquivalent, supplierId: existing.supplier_id },
    ],
  })
  if (!posted.ok) return glEditFailed(posted.message)

  await createAuditEntry({ tenantId, userId: user.id, action: 'update', entity: 'supplier_refunds', entityId: id, before: { amount: existing.amount, pkrEquivalent: existing.pkr_equivalent, date: existing.date }, after: { amount, pkrEquivalent, date } })

  return { success: true, data: undefined }
}
