import { toZonedTime, fromZonedTime, format } from 'date-fns-tz'

const PKT = 'Asia/Karachi'

export function toPKT(date: Date | string): Date {
  return toZonedTime(new Date(date), PKT)
}

export function toUTC(date: Date | string): Date {
  return fromZonedTime(new Date(date), PKT)
}

export function formatPKTDate(date: Date | string): string {
  return format(toPKT(date), 'dd MMM yyyy', { timeZone: PKT })
}

export function formatPKTDateTime(date: Date | string): string {
  return format(toPKT(date), 'dd MMM yyyy, hh:mm a', { timeZone: PKT })
}

/**
 * Today's calendar date in Pakistan as YYYY-MM-DD. Document dates are PKT
 * calendar dates, but the server runs on UTC — between 00:00 and 05:00 PKT a
 * plain new Date().toISOString() still says "yesterday". Safe on client and
 * server.
 */
export function todayPKT(): string {
  return format(toPKT(new Date()), 'yyyy-MM-dd', { timeZone: PKT })
}
