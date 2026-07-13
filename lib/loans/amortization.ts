// Equal-installment (interest-free) amortization for employee loans.
//
// The principal is split into `count` equal parts rounded to 2 decimals; the
// LAST installment absorbs the rounding remainder so the schedule always sums
// back to the principal exactly. Due dates step monthly from `firstDueDate`.

export type ScheduleRow = {
  installmentNo: number
  dueDate: string // YYYY-MM-DD
  amount: number
}

// Add `n` whole months to a YYYY-MM-DD string, clamping to the last valid day
// of the target month (e.g. Jan 31 + 1mo → Feb 28/29). Pure string math, no
// Date/timezone involvement so it is deterministic across environments.
export function addMonths(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const zeroBased = (m - 1) + n
  const year = y + Math.floor(zeroBased / 12)
  const month = ((zeroBased % 12) + 12) % 12 // 0..11
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const day = Math.min(d, lastDay)
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function generateSchedule(params: {
  principal: number
  installmentCount: number
  firstDueDate: string
  frequency?: 'monthly'
}): ScheduleRow[] {
  const { principal, installmentCount, firstDueDate } = params
  if (!Number.isFinite(installmentCount) || installmentCount <= 0) return []

  const base = round2(principal / installmentCount)
  const rows: ScheduleRow[] = []
  let allocated = 0
  for (let i = 0; i < installmentCount; i++) {
    const isLast = i === installmentCount - 1
    const amount = isLast ? round2(principal - allocated) : base
    allocated = round2(allocated + amount)
    rows.push({
      installmentNo: i + 1,
      dueDate: addMonths(firstDueDate, i),
      amount,
    })
  }
  return rows
}

// The equal-installment amount (first installment) for previewing / storing on
// the loan record. Returns null when there is no schedule.
export function installmentAmount(principal: number, installmentCount: number | null | undefined): number | null {
  if (!installmentCount || installmentCount <= 0) return null
  return round2(principal / installmentCount)
}
