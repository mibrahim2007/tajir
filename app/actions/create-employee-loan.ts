'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { nextDocumentSerial } from '@/lib/serials/next-serial'
import { aggregateMoneyLegs, type TenderType, tenderLineSchema } from '@/lib/constants/tender-types'
import { generateSchedule, installmentAmount } from '@/lib/loans/amortization'
import { glCreateFailed } from '@/lib/accounting/gl-failure'
import { verifyEndorsable, markEndorsed, releaseEndorsement, type EndorsementRef } from '@/lib/pdc/endorsement'
import type { PdcSource } from '@/lib/pdc/sources'
import type { ActionResult } from '@/lib/types'


const schema = z.object({
  employeeId:       z.string().uuid('Select an employee'),
  currencyCode:     z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:     z.coerce.number().positive().default(1),
  disbursementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  installmentCount: z.coerce.number().int().min(0).optional(),
  firstDueDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').optional(),
  notes:            z.string().trim().optional(),
  lines:            z.array(tenderLineSchema).min(1, 'Add at least one tender line'),
})

// Disburses an interest-free loan/advance to an employee (owner-only, money out).
//   GL: DR Employee Loans & Advances (1135) / CR Cash|Bank|PDC (per tender leg)
// When installmentCount > 0, an equal-installment monthly schedule is generated
// and stored (last installment absorbs the rounding remainder).
export async function createEmployeeLoanAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can disburse loans', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { employeeId, currencyCode, exchangeRate, disbursementDate, installmentCount, firstDueDate, notes, lines } = parsed.data
  const rate = currencyCode === 'USD' ? exchangeRate : 1

  // Resolve handed-on cheques before anything is written — the cheque's own
  // amount is authoritative, and one already spent must stop the disbursement
  // here rather than after the loan exists.
  const endorsements: EndorsementRef[] = []
  for (const l of lines) {
    if (!l.endorsedFromLineId || !l.endorsedFromSource) continue
    const ref = { source: l.endorsedFromSource as PdcSource, lineId: l.endorsedFromLineId }
    const check = await verifyEndorsable(tenantId, ref)
    if (!check.ok) return { success: false, error: check.message, code: 'VALIDATION_ERROR' }
    l.amount        = Number(check.cheque.amount)
    l.chequeNumber  = check.cheque.cheque_number ?? l.chequeNumber
    l.chequeDueDate = check.cheque.cheque_due_date ?? l.chequeDueDate
    endorsements.push(ref)
  }

  const principal = lines.reduce((s, l) => s + l.amount, 0)
  if (principal <= 0) return { success: false, error: 'Amount must be positive', code: 'VALIDATION_ERROR' }
  const pkrEquivalent = principal * rate

  const hasSchedule = !!installmentCount && installmentCount > 0
  if (hasSchedule && !firstDueDate) {
    return { success: false, error: 'First due date is required when setting installments', code: 'VALIDATION_ERROR' }
  }

  const admin = createAdminClient()

  // Confirm the employee belongs to this tenant.
  const { data: emp } = await admin
    .from('employees').select('id').eq('id', employeeId).eq('tenant_id', tenantId).maybeSingle()
  if (!emp) return { success: false, error: 'Employee not found', code: 'NOT_FOUND' }

  const serialNumber = await nextDocumentSerial(admin, tenantId, 'employee_loan', disbursementDate)

  const { data: loan, error } = await admin
    .from('employee_loans')
    .insert({
      tenant_id:          tenantId,
      serial_number:      serialNumber,
      employee_id:        employeeId,
      principal,
      currency_code:      currencyCode,
      exchange_rate:      rate,
      pkr_equivalent:     pkrEquivalent,
      disbursement_date:  disbursementDate,
      installment_count:  hasSchedule ? installmentCount : null,
      installment_amount: hasSchedule ? installmentAmount(principal, installmentCount) : null,
      first_due_date:     hasSchedule ? firstDueDate : null,
      notes:              notes || null,
    })
    .select('id')
    .single()

  if (error || !loan) {
    return { success: false, error: 'Failed to record loan', code: 'INTERNAL_ERROR' }
  }

  // Tender-line detail (how the money left the business).
  const lineRows = lines.map((l, i) => ({
    tenant_id:        tenantId,
    loan_id:          loan.id,
    line_no:          i + 1,
    transaction_type: l.transactionType,
    cheque_number:    l.chequeNumber || null,
    cheque_due_date:  l.chequeDueDate || null,
    bank_id:          l.bankId ?? null,
    amount:           l.amount,
    endorsed_from_source:  l.endorsedFromSource || null,
    endorsed_from_line_id: l.endorsedFromLineId || null,
  }))
  const { error: linesError } = await admin.from('loan_disbursement_lines').insert(lineRows)
  if (linesError) {
    await admin.from('employee_loans').delete().eq('id', loan.id)
    return { success: false, error: 'Failed to save disbursement lines', code: 'INTERNAL_ERROR' }
  }

  // Consume the source cheques, backing the whole loan out if another document
  // took one first.
  for (const [taken, ref] of endorsements.entries()) {
    if (await markEndorsed(tenantId, ref)) continue
    for (const done of endorsements.slice(0, taken)) await releaseEndorsement(tenantId, done)
    await admin.from('employee_loans').delete().eq('id', loan.id)
    return {
      success: false,
      error: 'That cheque was just used elsewhere, so nothing was saved. Reload and pick another.',
      code: 'CONFLICT',
    }
  }

  // Amortization schedule (in loan currency — the ledger runs in PKR-equivalent).
  if (hasSchedule) {
    const schedule = generateSchedule({ principal, installmentCount: installmentCount!, firstDueDate: firstDueDate! })
    if (schedule.length > 0) {
      await admin.from('loan_installments').insert(
        schedule.map((s) => ({
          tenant_id:      tenantId,
          loan_id:        loan.id,
          installment_no: s.installmentNo,
          due_date:       s.dueDate,
          amount:         s.amount,
        })),
      )
    }
  }

  // Auto-post GL: DR Employee Loans & Advances, CR each money account.
  // A disbursement is money going out, so a PDC leg is a liability we owe.
  const moneyLegs = aggregateMoneyLegs(
    lines.map((l) => ({ transactionType: l.transactionType as TenderType, amount: l.amount })),
    rate,
    'out',
  )
  const posted = await postJournalEntry({
    tenantId, date: disbursementDate, description: 'Employee Loan Disbursed', reference: serialNumber,
    sourceType: 'employee_loan', sourceId: loan.id, prefix: 'LN',
    lines: [
      { accountSystemKey: 'employee_loans_receivable', debit: pkrEquivalent, credit: 0, employeeId },
      ...moneyLegs.map((leg) => ({ accountSystemKey: leg.accountSystemKey, debit: 0, credit: leg.pkr })),
    ],
  })
  // Disbursement lines and the schedule cascade from the loan row.
  if (!posted.ok) {
    await admin.from('employee_loans').delete().eq('id', loan.id)
    // The loan is gone, so any cheque it consumed goes back in hand.
    for (const ref of endorsements) await releaseEndorsement(tenantId, ref)
    return glCreateFailed(posted.message)
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create', entity: 'employee_loans', entityId: loan.id,
    after: { employeeId, principal, currencyCode, pkrEquivalent, installmentCount: hasSchedule ? installmentCount : null, date: disbursementDate },
  })

  return { success: true, data: loan }
}
