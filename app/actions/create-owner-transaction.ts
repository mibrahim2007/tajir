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
  ownerId:      z.string().uuid('Select an owner'),
  txnType:      z.enum(['withdrawal', 'contribution']),
  currencyCode: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.coerce.number().positive().default(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  notes:        z.string().trim().optional(),
  lines:        z.array(lineSchema).min(1, 'Add at least one tender line'),
})

// Records an owner's capital movement (owner-only). Both directions share this
// action because they are the same document shape in opposite directions:
//   Withdrawal:   DR Owner's Drawings (3400) / CR Cash|Bank|PDC (per tender leg)
//   Contribution: DR Cash|Bank|PDC (per tender leg) / CR Owner's Capital (3100)
//
// A withdrawal is a DRAWING, never an expense — it reduces equity and must not
// reach the P&L. The owner is carried as the `owner_id` dimension on the equity
// leg, so a per-owner position is a GROUP BY rather than a separate account.
export async function createOwnerTransactionAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can record capital movements', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { ownerId, txnType, currencyCode, exchangeRate, date, notes, lines } = parsed.data
  const rate = currencyCode === 'USD' ? exchangeRate : 1

  const amount = lines.reduce((s, l) => s + l.amount, 0)
  if (amount <= 0) return { success: false, error: 'Amount must be positive', code: 'VALIDATION_ERROR' }
  const pkrEquivalent = amount * rate

  const admin = createAdminClient()

  // Confirm the owner belongs to this tenant.
  const { data: own } = await admin
    .from('owners').select('id, name').eq('id', ownerId).eq('tenant_id', tenantId).maybeSingle()
  if (!own) return { success: false, error: 'Owner not found', code: 'NOT_FOUND' }

  const isWithdrawal = txnType === 'withdrawal'
  const docType = isWithdrawal ? 'owner_withdrawal' : 'owner_contribution'
  const serialNumber = await nextDocumentSerial(admin, tenantId, docType, date)

  const { data: txn, error } = await admin
    .from('owner_transactions')
    .insert({
      tenant_id:      tenantId,
      serial_number:  serialNumber,
      owner_id:       ownerId,
      txn_type:       txnType,
      amount,
      currency_code:  currencyCode,
      exchange_rate:  rate,
      pkr_equivalent: pkrEquivalent,
      date,
      notes:          notes || null,
    })
    .select('id')
    .single()

  if (error || !txn) {
    return { success: false, error: 'Failed to record transaction', code: 'INTERNAL_ERROR' }
  }

  // Tender-line detail (how the money moved).
  const lineRows = lines.map((l, i) => ({
    tenant_id:        tenantId,
    transaction_id:   txn.id,
    line_no:          i + 1,
    transaction_type: l.transactionType,
    cheque_number:    l.chequeNumber || null,
    bank_id:          l.bankId ?? null,
    amount:           l.amount,
  }))
  const { error: linesError } = await admin.from('owner_transaction_lines').insert(lineRows)
  if (linesError) {
    await admin.from('owner_transactions').delete().eq('id', txn.id)
    return { success: false, error: 'Failed to save tender lines', code: 'INTERNAL_ERROR' }
  }

  // Auto-post GL. The equity leg carries the owner dimension; the money legs
  // are aggregated per target account so several lines of one tender type
  // collapse into a single clean GL line.
  const moneyLegs = aggregateMoneyLegs(
    lines.map((l) => ({ transactionType: l.transactionType as TenderType, amount: l.amount })),
    rate,
  )
  const equityLeg = isWithdrawal
    ? { accountSystemKey: 'owners_drawings', debit: pkrEquivalent, credit: 0, ownerId }
    : { accountSystemKey: 'owners_capital',  debit: 0, credit: pkrEquivalent, ownerId }
  const moneyLines = moneyLegs.map((leg) =>
    isWithdrawal
      ? { accountSystemKey: leg.accountSystemKey, debit: 0, credit: leg.pkr }
      : { accountSystemKey: leg.accountSystemKey, debit: leg.pkr, credit: 0 },
  )

  const posted = await postJournalEntry({
    tenantId,
    date,
    description: isWithdrawal ? 'Owner Withdrawal' : 'Owner Capital Contribution',
    reference:   serialNumber,
    sourceType:  docType,
    sourceId:    txn.id,
    prefix:      isWithdrawal ? 'OW' : 'OC',
    lines: isWithdrawal ? [equityLeg, ...moneyLines] : [...moneyLines, equityLeg],
  })

  // Never leave the document behind without its GL entry — the cash movement
  // would be invisible to the ledger. Roll the whole thing back instead.
  if (!posted.ok) {
    await admin.from('owner_transactions').delete().eq('id', txn.id)
    return { success: false, error: `Could not post to the ledger: ${posted.message}`, code: 'GL_POST_FAILED' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create', entity: 'owner_transactions', entityId: txn.id,
    after: { ownerId, ownerName: own.name, txnType, amount, currencyCode, pkrEquivalent, date },
  })

  return { success: true, data: txn }
}
