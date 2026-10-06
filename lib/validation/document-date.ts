import { z } from 'zod'
import { todayPKT } from '@/lib/utils/dates'

// A transaction is recorded for something that has already happened, so its
// document date may not be later than today (Pakistan time). A future-dated
// sale or receipt would sit in the books ahead of reality: it shows in today's
// balances and reports while the event hasn't occurred, and it dodges the
// period lock, which only guards the past.
//
// This is the DOCUMENT date only. Dates that are meant to be in the future —
// a cheque's due date, a sale's payment-due date, a loan's first installment —
// keep their own plain schemas.

export const FUTURE_DATE_ERROR = 'Date cannot be in the future'

export function isFutureDate(date: string): boolean {
  return date > todayPKT()
}

/** YYYY-MM-DD, today or earlier (PKT). Use for every transaction's own date. */
export const documentDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')
  .refine((d) => !isFutureDate(d), FUTURE_DATE_ERROR)
