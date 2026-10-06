// Future-date check — run with `npm run check:future-date`.
//
// No transaction may carry a document date after today in Pakistan. The
// trap is the time zone: the server runs on UTC, so from 00:00 to 05:00 PKT
// a naive "today" is still yesterday and the user's real today would be
// rejected as "future". todayPKT() must follow Asia/Karachi, not UTC.
//
// Pure functions, no database.

import { documentDateSchema, FUTURE_DATE_ERROR, isFutureDate } from '@/lib/validation/document-date'
import { todayPKT } from '@/lib/utils/dates'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

const shift = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const today = todayPKT()
const pktNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }))
const expected = `${pktNow.getFullYear()}-${String(pktNow.getMonth() + 1).padStart(2, '0')}-${String(pktNow.getDate()).padStart(2, '0')}`

console.log('\n— Today is the Pakistan calendar date —')
check('todayPKT() matches the Asia/Karachi wall clock', today === expected, `${today} vs ${expected}`)

console.log('\n— Past and present are accepted —')
check('today', documentDateSchema.safeParse(today).success)
check('yesterday', documentDateSchema.safeParse(shift(today, -1)).success)
check('a year ago', documentDateSchema.safeParse(shift(today, -365)).success)

console.log('\n— The future is refused —')
const tomorrow = documentDateSchema.safeParse(shift(today, 1))
check('tomorrow', !tomorrow.success && tomorrow.error.issues[0].message === FUTURE_DATE_ERROR)
check('next year', !documentDateSchema.safeParse(shift(today, 365)).success)
check('isFutureDate(tomorrow) — the GL posting backstop', isFutureDate(shift(today, 1)) && !isFutureDate(today))

console.log('\n— Malformed input is still refused —')
check('not a date', !documentDateSchema.safeParse('06/10/2026').success)

console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
