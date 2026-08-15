'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { nextDocumentSerial } from '@/lib/serials/next-serial'
import { aggregateMoneyLegs, type TenderType, tenderLineSchema } from '@/lib/constants/tender-types'
import { AGENT_PAYABLE_KEY } from '@/lib/agents/apply-commission'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  agentId:      z.string().uuid('Select an agent'),
  currencyCode: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.coerce.number().positive().default(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  notes:        z.string().trim().optional(),
  lines:        z.array(tenderLineSchema).min(1, 'Add at least one tender line'),
})

export type CreateAgentPaymentInput = z.infer<typeof schema>

/**
 * Pays an agent the commission they have earned.
 *
 * GL: DR Agent Commission Payable (2150, carrying the agent dimension)
 *     CR Cash / Bank / PDC-issued, one leg per tender type.
 *
 * A payout is deliberately NOT tied to particular invoices: agents are settled
 * on account, in round sums, against a running balance — so the ledger nets
 * accruals against payouts rather than trying to match them one to one.
 */
export async function createAgentPaymentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only the Owner can pay agents', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { agentId, currencyCode, exchangeRate, date, notes, lines } = parsed.data
  const rate = currencyCode === 'USD' ? exchangeRate : 1

  const amount = lines.reduce((s, l) => s + l.amount, 0)
  if (amount <= 0) return { success: false, error: 'Amount must be positive', code: 'VALIDATION_ERROR' }
  const pkrEquivalent = amount * rate

  const admin = createAdminClient()

  const { data: agent } = await admin
    .from('agents').select('id, name').eq('id', agentId).eq('tenant_id', tenantId).maybeSingle()
  if (!agent) return { success: false, error: 'Agent not found', code: 'NOT_FOUND' }

  const serialNumber = await nextDocumentSerial(admin, tenantId, 'agent_payment', date)

  const { data: payment, error } = await admin
    .from('agent_payments')
    .insert({
      tenant_id:      tenantId,
      serial_number:  serialNumber,
      agent_id:       agentId,
      amount,
      currency_code:  currencyCode,
      exchange_rate:  rate,
      pkr_equivalent: pkrEquivalent,
      date,
      notes: notes || null,
    })
    .select('id')
    .single()

  if (error || !payment) {
    return { success: false, error: 'Failed to record payment', code: 'INTERNAL_ERROR' }
  }

  const lineRows = lines.map((l, i) => ({
    tenant_id:        tenantId,
    payment_id:       payment.id,
    line_no:          i + 1,
    transaction_type: l.transactionType,
    cheque_number:    l.chequeNumber || null,
    cheque_due_date:  l.chequeDueDate || null,
    bank_id:          l.bankId ?? null,
    amount:           l.amount,
  }))
  const { error: linesError } = await admin.from('agent_payment_lines').insert(lineRows)
  if (linesError) {
    await admin.from('agent_payments').delete().eq('id', payment.id)
    return { success: false, error: 'Failed to save tender lines', code: 'INTERNAL_ERROR' }
  }

  // Money going OUT, so a cheque leg lands on the issued-cheque LIABILITY (2115)
  // rather than the received-cheque asset — see aggregateMoneyLegs.
  const moneyLegs = aggregateMoneyLegs(
    lines.map((l) => ({ transactionType: l.transactionType as TenderType, amount: l.amount })),
    rate,
    'out',
  )

  const posted = await postJournalEntry({
    tenantId, date,
    description: 'Agent Commission Payment',
    reference:   serialNumber,
    sourceType:  'agent_payment',
    sourceId:    payment.id,
    prefix:      'AGP',
    lines: [
      { accountSystemKey: AGENT_PAYABLE_KEY, debit: pkrEquivalent, credit: 0, agentId },
      ...moneyLegs.map((leg) => ({ accountSystemKey: leg.accountSystemKey, debit: 0, credit: leg.pkr })),
    ],
  })

  // Never leave the payout behind without its GL entry — the cash would have
  // left the business invisibly. Roll the whole document back instead.
  if (!posted.ok) {
    await admin.from('agent_payments').delete().eq('id', payment.id)
    return { success: false, error: `Could not post to the ledger: ${posted.message}`, code: 'GL_POST_FAILED' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create', entity: 'agent_payments', entityId: payment.id,
    after: { agentId, agentName: agent.name, amount, currencyCode, pkrEquivalent, date },
  })

  return { success: true, data: payment }
}
