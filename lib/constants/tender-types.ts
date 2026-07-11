// Tender types for a receipt/payment detail line. Each maps to the chart-of-
// accounts system_key its money leg posts to in the GL.
//   Cash   → Cash in Hand (1110)
//   Online → Cash at Bank (1120)
//   PDC    → Post-Dated Cheques (1112)
export const TENDER_TYPES = [
  { value: 'cash',   label: 'Cash',   account: 'cash_in_hand' },
  { value: 'online', label: 'Online', account: 'cash_at_bank' },
  { value: 'pdc',    label: 'PDC',    account: 'post_dated_cheques' },
] as const

export type TenderType = (typeof TENDER_TYPES)[number]['value']

export const TENDER_ACCOUNT: Record<TenderType, string> = {
  cash:   'cash_in_hand',
  online: 'cash_at_bank',
  pdc:    'post_dated_cheques',
}

export const TENDER_LABEL: Record<TenderType, string> = {
  cash:   'Cash',
  online: 'Online',
  pdc:    'PDC',
}

// Aggregate tender lines into GL money legs, summing PKR by target account so a
// receipt/payment with several lines of the same type posts one clean GL line.
export function aggregateMoneyLegs(
  lines: { transactionType: TenderType; amount: number }[],
  rate: number,
): { accountSystemKey: string; pkr: number }[] {
  const byAccount = new Map<string, number>()
  for (const l of lines) {
    const key = TENDER_ACCOUNT[l.transactionType]
    byAccount.set(key, (byAccount.get(key) ?? 0) + l.amount * rate)
  }
  return [...byAccount.entries()].map(([accountSystemKey, pkr]) => ({ accountSystemKey, pkr }))
}
