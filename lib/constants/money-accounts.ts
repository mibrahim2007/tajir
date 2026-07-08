// Money accounts selectable on receipt / payment forms. The value is the
// chart-of-accounts system_key that the GL money leg posts to.
export const MONEY_ACCOUNTS = [
  { value: 'cash_in_hand',      label: 'Cash in Hand',    code: '1110' },
  { value: 'cash_at_bank',      label: 'Cash at Bank',    code: '1120' },
  { value: 'post_dated_cheques', label: 'PDC (Post-Dated Cheque)', code: '1112' },
] as const

export type MoneyAccount = (typeof MONEY_ACCOUNTS)[number]['value']
