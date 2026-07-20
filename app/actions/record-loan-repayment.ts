'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { nextDocumentSerial } from '@/lib/serials/next-serial'
import { aggregateMoneyLegs, type TenderType, tenderLineSchema } from '@/lib/constants/tender-types'
import { reconcileLoanStatuses } from '@/lib/loans/reconcile'
import { glCreateFailed } from '@/lib/accounting/gl-failure'
import type { ActionResult } from '@/lib/types'


const schema = z.object({
  employeeId:        z.string().uuid('Select an employee'),
  loanId:            z.string().uuid().optional().nullable(),
  currencyCode:      z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:      z.coerce.number().positive().default(1),
  date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentMethodNote: z.string().optional(),
  lines:             z.array(tenderLineSchema).min(1, 'Add at least one tender line'),
})

// Records a loan installment / repayment from an employee (owner OR assistant —
// staff must be able to capture repayments, so this is NOT owner-gated, mirroring
// customer receipts).
//   GL: DR Cash|Bank|PDC (per tender leg) / CR Employee Loans & Advances (1135)
export async function recordLoanRepaymentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, tenantId } = await requireAuth()

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { employeeId, loanId, currencyCode, exchangeRate, date, paymentMethodNote, lines } = parsed.data
  const rate = currencyCode === 'USD' ? exchangeRate : 1

  const amount = lines.reduce((s, l) => s + l.amount, 0)
  if (amount <= 0) return { success: false, error: 'Amount must be positive', code: 'VALIDATION_ERROR' }
  const pkrEquivalent = amount * rate

  const admin = createAdminClient()

  // Confirm the employee belongs to this tenant.
  const { data: emp } = await admin
    .from('employees').select('id').eq('id', employeeId).eq('tenant_id', tenantId).maybeSingle()
  if (!emp) return { success: false, error: 'Employee not found', code: 'NOT_FOUND' }

  // If a specific loan is named, confirm it belongs to this employee/tenant.
  if (loanId) {
    const { data: loan } = await admin
      .from('employee_loans').select('id').eq('id', loanId).eq('employee_id', employeeId).eq('tenant_id', tenantId).maybeSingle()
    if (!loan) return { success: false, error: 'Loan not found for this employee', code: 'NOT_FOUND' }
  }

  const serialNumber = await nextDocumentSerial(admin, tenantId, 'loan_repayment', date)

  const { data: repayment, error } = await admin
    .from('loan_repayments')
    .insert({
      tenant_id:            tenantId,
      serial_number:        serialNumber,
      employee_id:          employeeId,
      loan_id:              loanId ?? null,
      amount,
      currency_code:        currencyCode,
      exchange_rate:        rate,
      pkr_equivalent:       pkrEquivalent,
      payment_method_note:  paymentMethodNote || null,
      date,
    })
    .select('id')
    .single()

  if (error || !repayment) {
    return { success: false, error: 'Failed to record repayment', code: 'INTERNAL_ERROR' }
  }

  const lineRows = lines.map((l, i) => ({
    tenant_id:        tenantId,
    repayment_id:     repayment.id,
    line_no:          i + 1,
    transaction_type: l.transactionType,
    cheque_number:    l.chequeNumber || null,
    cheque_due_date:  l.chequeDueDate || null,
    bank_id:          l.bankId ?? null,
    amount:           l.amount,
  }))
  const { error: linesError } = await admin.from('loan_repayment_lines').insert(lineRows)
  if (linesError) {
    await admin.from('loan_repayments').delete().eq('id', repayment.id)
    return { success: false, error: 'Failed to save repayment lines', code: 'INTERNAL_ERROR' }
  }

  // Auto-post GL: DR each money account, CR Employee Loans & Advances.
  const moneyLegs = aggregateMoneyLegs(
    lines.map((l) => ({ transactionType: l.transactionType as TenderType, amount: l.amount })),
    rate,
  )
  const posted = await postJournalEntry({
    tenantId, date, description: 'Employee Loan Repayment', reference: serialNumber,
    sourceType: 'loan_repayment', sourceId: repayment.id, prefix: 'LR',
    lines: [
      ...moneyLegs.map((leg) => ({ accountSystemKey: leg.accountSystemKey, debit: leg.pkr, credit: 0 })),
      { accountSystemKey: 'employee_loans_receivable', debit: 0, credit: pkrEquivalent, employeeId },
    ],
  })
  // Roll back BEFORE reconciling loan statuses, so a failed post can't close a
  // loan on the strength of a repayment that was never recorded in the ledger.
  if (!posted.ok) {
    await admin.from('loan_repayments').delete().eq('id', repayment.id)
    return glCreateFailed(posted.message)
  }

  // Auto-close any loan now fully repaid (or re-open on later reversal).
  await reconcileLoanStatuses(admin, tenantId, employeeId)

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create', entity: 'loan_repayments', entityId: repayment.id,
    after: { employeeId, loanId: loanId ?? null, amount, currencyCode, pkrEquivalent, date },
  })

  return { success: true, data: repayment }
}
