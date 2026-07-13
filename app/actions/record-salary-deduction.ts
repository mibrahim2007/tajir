'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { nextDocumentSerial } from '@/lib/serials/next-serial'
import { reconcileLoanStatuses } from '@/lib/loans/reconcile'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  employeeId: z.string().uuid('Select an employee'),
  loanId:     z.string().uuid().optional().nullable(),
  amount:     z.coerce.number().positive('Amount must be positive'),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  note:       z.string().optional(),
})

// Recovers a loan installment by withholding salary (owner-only, no cash moves).
//   GL: DR Salaries & Wages (6100) / CR Employee Loans & Advances (1135)
// Recorded as a loan_repayment with source='payroll' and no tender lines, so it
// flows through the ledger, allocation and auto-close like any other repayment.
export async function recordSalaryDeductionAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can run payroll deductions', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { employeeId, loanId, amount, date, note } = parsed.data
  const pkrEquivalent = amount // salary deductions are always PKR

  const admin = createAdminClient()

  const { data: emp } = await admin
    .from('employees').select('id').eq('id', employeeId).eq('tenant_id', tenantId).maybeSingle()
  if (!emp) return { success: false, error: 'Employee not found', code: 'NOT_FOUND' }

  if (loanId) {
    const { data: loan } = await admin
      .from('employee_loans').select('id').eq('id', loanId).eq('employee_id', employeeId).eq('tenant_id', tenantId).maybeSingle()
    if (!loan) return { success: false, error: 'Loan not found for this employee', code: 'NOT_FOUND' }
  }

  const serialNumber = await nextDocumentSerial(admin, tenantId, 'loan_repayment', date)

  const { data: repayment, error } = await admin
    .from('loan_repayments')
    .insert({
      tenant_id:           tenantId,
      serial_number:       serialNumber,
      employee_id:         employeeId,
      loan_id:             loanId ?? null,
      amount,
      currency_code:       'PKR',
      exchange_rate:       1,
      pkr_equivalent:      pkrEquivalent,
      payment_method_note: note ? `Salary deduction — ${note}` : 'Salary deduction',
      source:              'payroll',
      date,
    })
    .select('id')
    .single()

  if (error || !repayment) {
    return { success: false, error: 'Failed to record salary deduction', code: 'INTERNAL_ERROR' }
  }

  // GL: DR Salaries & Wages, CR Employee Loans & Advances. No cash leg.
  await postJournalEntry({
    tenantId, date, description: 'Loan Recovery via Salary Deduction', reference: serialNumber,
    sourceType: 'loan_repayment', sourceId: repayment.id, prefix: 'LR',
    lines: [
      { accountSystemKey: 'salaries_wages', debit: pkrEquivalent, credit: 0, employeeId },
      { accountSystemKey: 'employee_loans_receivable', debit: 0, credit: pkrEquivalent, employeeId },
    ],
  })

  await reconcileLoanStatuses(admin, tenantId, employeeId)

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create', entity: 'loan_repayments', entityId: repayment.id,
    after: { employeeId, loanId: loanId ?? null, amount, source: 'payroll', date },
  })

  return { success: true, data: repayment }
}
