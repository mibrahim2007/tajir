// Receivables / payables aging — one implementation.
//
// This bucketing existed in four copies (the two report pages and the two CSV
// export routes), and the two payables copies had drifted: they aged purchases
// against payments alone, ignoring purchase returns, debit notes and supplier
// refunds. That made the Payables Aging report disagree with the Suppliers
// page and with the dashboard, always showing MORE owed than was really owed.
// Both sides now use the same credit set as their party list.

import { createAdminClient } from '@/lib/supabase/admin'
import { allocateEmployeeLoans, type LoanInput, type RepaymentInput } from '@/lib/loans/allocation'

export function ageDays(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  return Math.floor((today.getTime() - d.getTime()) / 86_400_000)
}

export type AgingBuckets = {
  total: number
  bucket0_30: number
  bucket31_60: number
  bucket61_90: number
  bucket90plus: number
  oldestDate: string | null
}

export type AgingRow = AgingBuckets & {
  partyId: string
  partyName: string
}

const EMPTY: AgingBuckets = {
  total: 0, bucket0_30: 0, bucket31_60: 0, bucket61_90: 0, bucket90plus: 0, oldestDate: null,
}

/**
 * Ages one party's dated debit lines after settling `credits` against them
 * oldest-first. Payments are not tied to an invoice anywhere in Tajir, so FIFO
 * is the assumption: the oldest bill is the one considered paid.
 */
export function bucketParty(lines: { date: string; amount: number }[], credits: number): AgingBuckets {
  const ordered = [...lines].sort((a, b) => a.date.localeCompare(b.date))

  let remainingCredit = credits
  const out: AgingBuckets = { ...EMPTY }

  for (const line of ordered) {
    let remaining = line.amount
    if (remainingCredit > 0) {
      const allocated = Math.min(remainingCredit, remaining)
      remaining -= allocated
      remainingCredit -= allocated
    }
    if (remaining <= 0) continue

    out.total += remaining
    if (!out.oldestDate || line.date < out.oldestDate) out.oldestDate = line.date

    const age = ageDays(line.date)
    if (age <= 30) out.bucket0_30 += remaining
    else if (age <= 60) out.bucket31_60 += remaining
    else if (age <= 90) out.bucket61_90 += remaining
    else out.bucket90plus += remaining
  }

  return out
}

/** Column totals across parties, for a report footer or a dashboard card. */
export function sumBuckets(rows: AgingBuckets[]): AgingBuckets {
  return rows.reduce<AgingBuckets>((acc, r) => ({
    total:        acc.total + r.total,
    bucket0_30:   acc.bucket0_30 + r.bucket0_30,
    bucket31_60:  acc.bucket31_60 + r.bucket31_60,
    bucket61_90:  acc.bucket61_90 + r.bucket61_90,
    bucket90plus: acc.bucket90plus + r.bucket90plus,
    oldestDate:   !acc.oldestDate || (r.oldestDate && r.oldestDate < acc.oldestDate) ? (r.oldestDate ?? acc.oldestDate) : acc.oldestDate,
  }), { ...EMPTY })
}

const sumBy = <T,>(rows: T[], match: (r: T) => boolean, value: (r: T) => number) =>
  rows.filter(match).reduce((s, r) => s + value(r), 0)

/**
 * What each customer still owes, aged from the sale date.
 *
 * The opening balance is aged from the customer's creation date — it is the
 * oldest thing they owe and has no invoice of its own.
 */
export async function buildReceivablesAging(tenantId: string): Promise<AgingRow[]> {
  const admin = createAdminClient()

  const [
    { data: rawCustomers },
    { data: rawSales },
    { data: rawReceipts },
    { data: rawReturns },
    { data: rawCreditNotes },
    { data: rawRefunds },
  ] = await Promise.all([
    admin.from('tajir_customers').select('id, name, opening_balance_pkr_equivalent, created_at').eq('tenant_id', tenantId),
    admin.from('sales_orders').select('customer_id, pkr_equivalent, date').eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('ar_receipts').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('sale_returns').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('credit_notes').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('customer_refunds').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId),
  ])

  const sales = rawSales ?? []
  const rows: AgingRow[] = []

  for (const c of rawCustomers ?? []) {
    // A refund hands back a credit the customer was holding, so it un-does one.
    const credits =
      sumBy(rawReceipts ?? [], (r) => r.customer_id === c.id, (r) => r.pkr_equivalent) +
      sumBy(rawReturns ?? [], (r) => r.customer_id === c.id, (r) => r.pkr_equivalent) +
      sumBy(rawCreditNotes ?? [], (n) => n.customer_id === c.id, (n) => n.pkr_equivalent) -
      sumBy(rawRefunds ?? [], (r) => r.customer_id === c.id, (r) => r.pkr_equivalent)

    const lines = [
      ...(c.opening_balance_pkr_equivalent > 0
        ? [{ date: c.created_at.split('T')[0], amount: c.opening_balance_pkr_equivalent }]
        : []),
      ...sales.filter((s) => s.customer_id === c.id).map((s) => ({ date: s.date, amount: s.pkr_equivalent })),
    ]

    const buckets = bucketParty(lines, credits)
    if (buckets.total > 0.005) rows.push({ partyId: c.id, partyName: c.name, ...buckets })
  }

  return rows.sort((a, b) => b.total - a.total)
}

/**
 * What each employee still owes on loans and advances, aged the same way the
 * customer side is — so an unrecovered staff advance can be chased like an
 * unpaid invoice instead of only sitting as a balance on account 1135.
 *
 * The date an amount ages from depends on how the loan was set up:
 *
 *   • With an installment schedule → each UNPAID installment ages from its own
 *     due date. A twelve-month loan taken six months ago and repaid on time is
 *     current, not 90+ days late. Installments not yet due have a future date,
 *     so they land in the 0–30 (not-yet-overdue) column.
 *   • Without a schedule → the whole unrecovered amount ages from the
 *     disbursement date, since it is repayable on demand.
 *
 * Repayments are already netted off by allocateEmployeeLoans — the same FIFO
 * the ledger and the Employee Loans report use — so `credits` is zero here.
 * Passing them again would settle them twice.
 */
export function employeeLoanAgingLines(
  loans: LoanInput[],
  repayments: RepaymentInput[],
  today: string,
): { date: string; amount: number }[] {
  const { loans: allocated } = allocateEmployeeLoans(loans, repayments, today)
  const byId = new Map(loans.map((l) => [l.id, l]))

  const lines: { date: string; amount: number }[] = []
  for (const loan of allocated) {
    if (loan.outstandingPkr <= 0.005) continue
    const source = byId.get(loan.loanId)
    const unpaid = loan.installments
      .map((i) => ({ date: i.dueDate, amount: i.amountPkr - i.paidPkr }))
      .filter((i) => i.amount > 0.005)
    const unpaidTotal = unpaid.reduce((s, i) => s + i.amount, 0)

    // Fall back to one line at the disbursement date when there is no schedule,
    // or when the schedule does not account for the full outstanding amount —
    // the aged total must always equal the Employee Loans report's outstanding,
    // or the two reports disagree about the same money.
    if (unpaid.length > 0 && Math.abs(unpaidTotal - loan.outstandingPkr) < 0.01) {
      lines.push(...unpaid)
    } else {
      lines.push({ date: source?.disbursementDate ?? today, amount: loan.outstandingPkr })
    }
  }
  return lines
}

export async function buildEmployeeLoanAging(tenantId: string): Promise<AgingRow[]> {
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawEmployees }, { data: rawLoans }, { data: rawRepayments }] = await Promise.all([
    admin.from('employees').select('id, name').eq('tenant_id', tenantId),
    admin.from('employee_loans')
      .select('id, employee_id, disbursement_date, exchange_rate, pkr_equivalent, loan_installments(installment_no, due_date, amount)')
      .eq('tenant_id', tenantId).neq('status', 'void'),
    admin.from('loan_repayments').select('id, employee_id, date, pkr_equivalent, loan_id').eq('tenant_id', tenantId),
  ])

  const loans = rawLoans ?? []
  const repayments = rawRepayments ?? []
  const rows: AgingRow[] = []

  for (const emp of rawEmployees ?? []) {
    const empLoans: LoanInput[] = loans.filter((l) => l.employee_id === emp.id).map((l) => ({
      id: l.id,
      disbursementDate: l.disbursement_date,
      principalPkr: l.pkr_equivalent,
      installments: ((l.loan_installments ?? []) as { installment_no: number; due_date: string; amount: number }[])
        .map((i) => ({ installmentNo: i.installment_no, dueDate: i.due_date, amountPkr: i.amount * l.exchange_rate })),
    }))
    if (empLoans.length === 0) continue

    const empRepayments: RepaymentInput[] = repayments
      .filter((r) => r.employee_id === emp.id)
      .map((r) => ({ id: r.id, date: r.date, pkr: r.pkr_equivalent, loanId: r.loan_id ?? null }))

    const buckets = bucketParty(employeeLoanAgingLines(empLoans, empRepayments, today), 0)
    if (buckets.total > 0.005) rows.push({ partyId: emp.id, partyName: emp.name, ...buckets })
  }

  return rows.sort((a, b) => b.total - a.total)
}

/**
 * What is still owed to each supplier, aged from the purchase date.
 *
 * A purchase records the advance paid on the invoice itself, so only the
 * unpaid remainder ages.
 */
export async function buildPayablesAging(tenantId: string): Promise<AgingRow[]> {
  const admin = createAdminClient()

  const [
    { data: rawSuppliers },
    { data: rawPurchases },
    { data: rawPayments },
    { data: rawReturns },
    { data: rawDebitNotes },
    { data: rawRefunds },
  ] = await Promise.all([
    admin.from('suppliers').select('id, name, opening_balance_pkr_equivalent, created_at').eq('tenant_id', tenantId),
    admin.from('purchase_orders').select('supplier_id, pkr_equivalent, advance_paid, date').eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('ap_payments').select('supplier_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('purchase_returns').select('supplier_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('debit_notes').select('supplier_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('supplier_refunds').select('supplier_id, pkr_equivalent').eq('tenant_id', tenantId),
  ])

  const purchases = rawPurchases ?? []
  const rows: AgingRow[] = []

  for (const s of rawSuppliers ?? []) {
    // Mirror of the receivables side: a refund from the supplier hands back a
    // credit we were holding against them.
    const credits =
      sumBy(rawPayments ?? [], (p) => p.supplier_id === s.id, (p) => p.pkr_equivalent) +
      sumBy(rawReturns ?? [], (r) => r.supplier_id === s.id, (r) => r.pkr_equivalent) +
      sumBy(rawDebitNotes ?? [], (n) => n.supplier_id === s.id, (n) => n.pkr_equivalent) -
      sumBy(rawRefunds ?? [], (r) => r.supplier_id === s.id, (r) => r.pkr_equivalent)

    const lines = [
      ...(s.opening_balance_pkr_equivalent > 0
        ? [{ date: s.created_at.split('T')[0], amount: s.opening_balance_pkr_equivalent }]
        : []),
      ...purchases
        .filter((p) => p.supplier_id === s.id)
        .map((p) => ({ date: p.date, amount: p.pkr_equivalent - p.advance_paid }))
        .filter((p) => p.amount > 0),
    ]

    const buckets = bucketParty(lines, credits)
    if (buckets.total > 0.005) rows.push({ partyId: s.id, partyName: s.name, ...buckets })
  }

  return rows.sort((a, b) => b.total - a.total)
}
