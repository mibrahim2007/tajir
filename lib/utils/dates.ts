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
