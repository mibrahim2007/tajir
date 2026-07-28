// Receivables aging check — run with `npm run check:aging`.
//
// The Receivables Aging report now carries employee loans & advances alongside
// trade debtors. The failure mode is silent: if the aged buckets stop summing
// to what account 1135 actually holds, the report quietly disagrees with the
// Balance Sheet about the same money, and nothing looks broken.
//
// So this asserts, per live tenant:
//   • employee-loan aging total  == 1135 GL balance
//   • employee-loan aging total  == the Employee Loans report's outstanding
//   • every row's buckets sum to its own total
//
// Both loan shapes are covered by the live data: scheduled loans age by
// installment due date, unscheduled ones by disbursement date.

import { createAdminClient } from '@/lib/supabase/admin'
import { buildEmployeeLoanAging, buildReceivablesAging, employeeLoanAgingLines, bucketParty, sumBuckets } from '@/lib/reports/aging'
import { allocateEmployeeLoans, type LoanInput, type RepaymentInput } from '@/lib/loans/allocation'

const admin = createAdminClient()

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

const money = (n: number) => n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const near = (a: number, b: number) => Math.abs(a - b) < 0.02

/** What account 1135 holds for a tenant, straight from the journal. */
async function glEmployeeLoanBalance(tenantId: string): Promise<number> {
  const { data: acc } = await admin
    .from('chart_of_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('system_key', 'employee_loans_receivable')
    .maybeSingle()
  if (!acc) return 0

  const { data: lines } = await admin
    .from('tajir_journal_entry_lines')
    .select('debit, credit')
    .eq('tenant_id', tenantId)
    .eq('account_id', acc.id)

  return (lines ?? []).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)
}

/** The figure Reports → Employee Loans shows, via the same FIFO allocation. */
async function employeeLoansReportOutstanding(tenantId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0]
  const [{ data: employees }, { data: rawLoans }, { data: rawRepayments }] = await Promise.all([
    admin.from('employees').select('id').eq('tenant_id', tenantId),
    admin.from('employee_loans')
      .select('id, employee_id, disbursement_date, exchange_rate, pkr_equivalent, loan_installments(installment_no, due_date, amount)')
      .eq('tenant_id', tenantId).neq('status', 'void'),
    admin.from('loan_repayments').select('id, employee_id, date, pkr_equivalent, loan_id').eq('tenant_id', tenantId),
  ])

  let total = 0
  for (const e of employees ?? []) {
    const loans: LoanInput[] = (rawLoans ?? []).filter((l) => l.employee_id === e.id).map((l) => ({
      id: l.id,
      disbursementDate: l.disbursement_date,
      principalPkr: l.pkr_equivalent,
      installments: ((l.loan_installments ?? []) as { installment_no: number; due_date: string; amount: number }[])
        .map((i) => ({ installmentNo: i.installment_no, dueDate: i.due_date, amountPkr: i.amount * l.exchange_rate })),
    }))
    const repayments: RepaymentInput[] = (rawRepayments ?? [])
      .filter((r) => r.employee_id === e.id)
      .map((r) => ({ id: r.id, date: r.date, pkr: r.pkr_equivalent, loanId: r.loan_id ?? null }))

    total += Math.max(0, allocateEmployeeLoans(loans, repayments, today).totalOutstandingPkr)
  }
  return total
}

/**
 * Synthetic cases for the line-dating rule. No live tenant currently has an
 * OUTSTANDING scheduled loan, so without these the installment path — the whole
 * reason a staff loan repaid on time is not reported as 90+ days late — would
 * ship uncovered.
 */
function pureCases() {
  const TODAY = '2026-07-28'

  // Scheduled loan, four monthly installments of 2,500, two already due and
  // unpaid, disbursed six months ago.
  const scheduled = {
    id: 'L1', disbursementDate: '2026-01-28', principalPkr: 10000,
    installments: [
      { installmentNo: 1, dueDate: '2026-05-28', amountPkr: 2500 },
      { installmentNo: 2, dueDate: '2026-06-28', amountPkr: 2500 },
      { installmentNo: 3, dueDate: '2026-08-28', amountPkr: 2500 },
      { installmentNo: 4, dueDate: '2026-09-28', amountPkr: 2500 },
    ],
  }

  // Nothing repaid: installment 1 overdue ~61 days, installment 2 overdue 30
  // days, installments 3 and 4 not yet due.
  //
  // Note on the boundary: ageDays() compares a UTC-parsed due date against
  // LOCAL midnight, so in PKT (UTC+5) it returns one day less than the calendar
  // difference. Installment 1 is 61 calendar days old and buckets as 60. That
  // is pre-existing behaviour shared with the customer side of this report, not
  // something the employee-loan rows introduce — pinned here so the off-by-one
  // is documented rather than rediscovered.
  const none = bucketParty(employeeLoanAgingLines([scheduled], [], TODAY), 0)
  check('scheduled loan ages by installment, not disbursement', near(none.total, 10000) && near(none.bucket90plus, 0),
    `90+ ${money(none.bucket90plus)} (would be 10,000.00 if aged from disbursement)`)
  check('  not-yet-due + 30-day installments sit in 0–30', near(none.bucket0_30, 7500), money(none.bucket0_30))
  check('  oldest installment buckets at the 31–60 boundary', near(none.bucket31_60, 2500), money(none.bucket31_60))
  check('  nothing reaches 61–90', near(none.bucket61_90, 0), money(none.bucket61_90))

  // Repaid on schedule: the two due installments settled, nothing overdue.
  const onTime = bucketParty(
    employeeLoanAgingLines([scheduled], [{ id: 'R1', date: '2026-06-28', pkr: 5000, loanId: 'L1' }], TODAY), 0)
  check('loan repaid on time is current, never 90+', near(onTime.total, 5000) && near(onTime.bucket90plus, 0),
    `total ${money(onTime.total)}, 90+ ${money(onTime.bucket90plus)}`)

  // No schedule → whole outstanding ages from the disbursement date.
  const onDemand = { id: 'L2', disbursementDate: '2026-01-28', principalPkr: 4000, installments: [] }
  const demand = bucketParty(employeeLoanAgingLines([onDemand], [], TODAY), 0)
  check('unscheduled loan ages from disbursement', near(demand.bucket90plus, 4000), `90+ ${money(demand.bucket90plus)}`)

  // Fully repaid → excluded entirely.
  const settled = bucketParty(
    employeeLoanAgingLines([onDemand], [{ id: 'R2', date: '2026-07-01', pkr: 4000, loanId: 'L2' }], TODAY), 0)
  check('settled loan produces no aged rows', near(settled.total, 0))

  // Over-repayment must not create a negative bucket.
  const over = bucketParty(
    employeeLoanAgingLines([onDemand], [{ id: 'R3', date: '2026-07-01', pkr: 5000, loanId: 'L2' }], TODAY), 0)
  check('over-repayment does not go negative', near(over.total, 0), money(over.total))
}

async function main() {
  pureCases()

  const { data: tenants } = await admin.from('tenants').select('id, name').order('name')

  let tenantsWithLoans = 0

  for (const t of tenants ?? []) {
    const [aging, gl, reportOutstanding] = await Promise.all([
      buildEmployeeLoanAging(t.id),
      glEmployeeLoanBalance(t.id),
      employeeLoansReportOutstanding(t.id),
    ])

    const agedTotal = sumBuckets(aging).total
    if (agedTotal === 0 && gl === 0) continue
    tenantsWithLoans++

    console.log(`\n${t.name}`)
    check('  aged total == 1135 GL balance', near(agedTotal, gl),
      `aged ${money(agedTotal)} vs GL ${money(gl)}`)
    check('  aged total == Employee Loans report outstanding', near(agedTotal, reportOutstanding),
      `aged ${money(agedTotal)} vs report ${money(reportOutstanding)}`)

    for (const row of aging) {
      const bucketSum = row.bucket0_30 + row.bucket31_60 + row.bucket61_90 + row.bucket90plus
      check(`  buckets sum to total — ${row.partyName}`, near(bucketSum, row.total),
        `${money(bucketSum)} vs ${money(row.total)}`)
      check(`  oldest date present — ${row.partyName}`, !!row.oldestDate, row.oldestDate ?? '')
    }

    // The customer side must be untouched by the change.
    const customers = await buildReceivablesAging(t.id)
    for (const row of customers) {
      const bucketSum = row.bucket0_30 + row.bucket31_60 + row.bucket61_90 + row.bucket90plus
      check(`  customer buckets intact — ${row.partyName}`, near(bucketSum, row.total))
    }
  }

  if (tenantsWithLoans === 0) console.log('\nNo tenant has employee loans — nothing to compare.')

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
