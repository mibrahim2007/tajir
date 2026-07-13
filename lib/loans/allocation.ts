// FIFO allocation of repayments across an employee's loans, and within each
// loan across its installment schedule. DISPLAY / SETTLEMENT ONLY — the GL and
// the employee-level outstanding never depend on this (they use employee_id +
// pkr only). Kept pure so both the ledger page and the report can reuse it.
//
// Rules:
//   • A repayment with an explicit loanId is applied to that loan.
//   • A repayment with loanId = null is pooled and filled into loans oldest-
//     first (by disbursement date); any leftover (over-repayment) lands on the
//     newest loan so Σ allocated always equals Σ repayments (nothing is lost).
//   • Within a loan, the allocated amount settles installments in order.

const EPS = 0.01

export type LoanInput = {
  id: string
  disbursementDate: string
  principalPkr: number
  installments: { installmentNo: number; dueDate: string; amountPkr: number }[]
}

export type RepaymentInput = {
  id: string
  date: string
  pkr: number
  loanId: string | null
}

export type InstallmentStatus = 'paid' | 'partial' | 'overdue' | 'due'

export type AllocatedInstallment = {
  installmentNo: number
  dueDate: string
  amountPkr: number
  paidPkr: number
  status: InstallmentStatus
}

export type AllocatedLoan = {
  loanId: string
  principalPkr: number
  paidPkr: number
  outstandingPkr: number
  isSettled: boolean
  overduePkr: number
  installments: AllocatedInstallment[]
}

export type Allocation = {
  loans: AllocatedLoan[]
  totalOutstandingPkr: number
  totalOverduePkr: number
}

export function allocateEmployeeLoans(
  loans: LoanInput[],
  repayments: RepaymentInput[],
  today: string,
): Allocation {
  // Oldest first (tie-break on id for determinism).
  const ordered = [...loans].sort((a, b) => a.disbursementDate.localeCompare(b.disbursementDate) || a.id.localeCompare(b.id))
  const paid = new Map<string, number>(ordered.map((l) => [l.id, 0]))
  const loanIds = new Set(ordered.map((l) => l.id))

  // 1) Targeted repayments.
  let pool = 0
  for (const r of repayments) {
    if (r.loanId && loanIds.has(r.loanId)) {
      paid.set(r.loanId, (paid.get(r.loanId) ?? 0) + r.pkr)
    } else {
      pool += r.pkr
    }
  }

  // 2) Untargeted pool → fill loans oldest-first up to principal.
  for (const loan of ordered) {
    if (pool <= EPS) break
    const capacity = loan.principalPkr - (paid.get(loan.id) ?? 0)
    if (capacity <= 0) continue
    const take = Math.min(capacity, pool)
    paid.set(loan.id, (paid.get(loan.id) ?? 0) + take)
    pool -= take
  }
  // 3) Leftover over-repayment → newest loan, so Σ allocated = Σ repayments.
  if (pool > EPS && ordered.length > 0) {
    const last = ordered[ordered.length - 1]
    paid.set(last.id, (paid.get(last.id) ?? 0) + pool)
    pool = 0
  }

  let totalOutstandingPkr = 0
  let totalOverduePkr = 0

  const resultLoans: AllocatedLoan[] = ordered.map((loan) => {
    const paidPkr = paid.get(loan.id) ?? 0
    const outstandingPkr = round2(loan.principalPkr - paidPkr)
    totalOutstandingPkr += outstandingPkr

    // Settle installments in order from the loan's allocated amount.
    let remaining = paidPkr
    let overduePkr = 0
    const installments: AllocatedInstallment[] = [...loan.installments]
      .sort((a, b) => a.installmentNo - b.installmentNo)
      .map((inst) => {
        const instPaid = Math.min(inst.amountPkr, Math.max(0, remaining))
        remaining = round2(remaining - instPaid)
        const unpaid = round2(inst.amountPkr - instPaid)
        const isOverdue = unpaid > EPS && inst.dueDate < today
        if (isOverdue) overduePkr = round2(overduePkr + unpaid)
        const status: InstallmentStatus =
          unpaid <= EPS ? 'paid' : isOverdue ? 'overdue' : instPaid > EPS ? 'partial' : 'due'
        return { installmentNo: inst.installmentNo, dueDate: inst.dueDate, amountPkr: inst.amountPkr, paidPkr: round2(instPaid), status }
      })

    totalOverduePkr += overduePkr
    return {
      loanId: loan.id,
      principalPkr: loan.principalPkr,
      paidPkr: round2(paidPkr),
      outstandingPkr,
      isSettled: outstandingPkr <= EPS,
      overduePkr,
      installments,
    }
  })

  return { loans: resultLoans, totalOutstandingPkr: round2(totalOutstandingPkr), totalOverduePkr: round2(totalOverduePkr) }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
