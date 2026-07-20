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
  customerId:    z.string().uuid('Invalid customer'),
  amount:        z.coerce.number().positive('Amount must be positive').optional(),
  currencyCode:  z.enum(['PKR', 'USD']),
  exchangeRate:  z.coerce.number().positive().default(1),
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  // Legacy single-tender path; a lined refund carries the breakdown in `lines`.
  paymentMethod: z.enum(['cash', 'bank_transfer']).optional(),
  notes:         z.string().optional(),
  lines:         z.array(tenderLineSchema).optional(),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD transactions', path: ['exchangeRate'] },
)

export type CreateCustomerRefundInput = z.infer<typeof schema>

export async function createCustomerRefundAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, role, tenantId } = await requireAuth()

  if (role !== 'owner') {
    return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }
  }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { customerId, currencyCode, exchangeRate, date, paymentMethod, notes, lines } = parsed.data
  const rate = currencyCode === 'USD' ? exchangeRate : 1

  // Total is the sum of tender lines when provided, else the single amount.
  const hasLines = !!lines && lines.length > 0
  const amount = hasLines ? lines!.reduce((s, l) => s + l.amount, 0) : (parsed.data.amount ?? 0)
  if (amount <= 0) return { success: false, error: 'Amount must be positive', code: 'VALIDATION_ERROR' }
  const pkrEquivalent = amount * rate

  const admin = createAdminClient()

  const { count: coaCount } = await admin
    .from('chart_of_accounts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (!coaCount) {
    return { success: false, error: 'Chart of accounts is not set up. Go to Accounts and configure it first.', code: 'COA_NOT_CONFIGURED' }
  }

  const serialNumber = await nextDocumentSerial(admin, tenantId, 'customer_refund', date)
  const { data: refund, error: insertError } = await admin
    .from('customer_refunds')
    .insert({
      tenant_id:      tenantId,
      serial_number:  serialNumber,
      customer_id:    customerId,
      amount,
      currency_code:  currencyCode,
      exchange_rate:  exchangeRate,
      pkr_equivalent: pkrEquivalent,
      date,
      // For lined refunds the tender detail lives in customer_refund_lines.
      payment_method: hasLines ? null : (paymentMethod ?? 'cash'),
      notes:          notes ?? null,
    })
    .select('id')
    .single()

  if (insertError || !refund) {
    return { success: false, error: 'Failed to create customer refund', code: 'INTERNAL_ERROR' }
  }

  // Persist tender detail lines
  if (hasLines) {
    const lineRows = lines!.map((l, i) => ({
      tenant_id:        tenantId,
      refund_id:        refund.id,
      line_no:          i + 1,
      transaction_type: l.transactionType,
      cheque_number:    l.chequeNumber || null,
    cheque_due_date:  l.chequeDueDate || null,
      bank_id:          l.bankId ?? null,
      amount:           l.amount,
    }))
    const { error: linesError } = await admin.from('customer_refund_lines').insert(lineRows)
    if (linesError) {
      await admin.from('customer_refunds').delete().eq('id', refund.id)
      return { success: false, error: 'Failed to save refund lines', code: 'INTERNAL_ERROR' }
    }
  }

  // Auto-post GL: DR Accounts Receivable (reduces the customer's credit balance),
  // CR each money account (money paid out, per tender type).
  const moneyLegs = hasLines
    ? aggregateMoneyLegs(lines!.map((l) => ({ transactionType: l.transactionType as TenderType, amount: l.amount })), rate)
    : [{ accountSystemKey: paymentMethod === 'bank_transfer' ? 'cash_at_bank' : 'cash_in_hand', pkr: pkrEquivalent }]

  const posted = await postJournalEntry({
    tenantId,
    date,
    description: 'Customer Refund',
    reference:   serialNumber,
    sourceType:  'customer_refund',
    sourceId:    refund.id,
    prefix:      'RF',
    lines: [
      { accountSystemKey: 'accounts_receivable', debit: pkrEquivalent, credit: 0, customerId },
      ...moneyLegs.map((leg) => ({ accountSystemKey: leg.accountSystemKey, debit: 0, credit: leg.pkr })),
    ],
  })
  if (!posted.ok) {
    await admin.from('customer_refunds').delete().eq('id', refund.id)
    return glCreateFailed(posted.message)
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create',
    entity: 'customer_refunds', entityId: refund.id,
    after: { customerId, amount, currencyCode, pkrEquivalent, date, notes },
  })

  return { success: true, data: refund }
}
