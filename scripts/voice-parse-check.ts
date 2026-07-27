// Voice expense parser check — run with `npm run check:voice`.
//
// The parser turns a spoken sentence into a draft expense. It never posts
// anything, so a wrong parse is a usability bug rather than a data bug — but a
// parser that quietly stops finding amounts would make the feature useless
// without anything looking broken. These are the phrasings it is built for,
// including the Roman-Urdu ones.

import { parseExpense, type ExpenseAccount } from '@/lib/voice/parse-expense'

// The standard seeded chart, which is what nearly every tenant has.
const ACCOUNTS: ExpenseAccount[] = [
  { id: 'a-cogs', code: '5100', name: 'Cost of Goods Sold' },
  { id: 'a-sal', code: '6100', name: 'Salaries & Wages' },
  { id: 'a-rent', code: '6200', name: 'Rent' },
  { id: 'a-util', code: '6300', name: 'Utilities' },
  { id: 'a-tran', code: '6400', name: 'Transportation & Freight' },
  { id: 'a-comm', code: '6500', name: 'Commission Expense' },
  { id: 'a-print', code: '6600', name: 'Printing & Stationery' },
  { id: 'a-tel', code: '6700', name: 'Telephone & Internet' },
  { id: 'a-rep', code: '6800', name: 'Repair & Maintenance' },
  { id: 'a-bank', code: '7100', name: 'Bank Charges' },
]
const BANKS = [{ id: 'b-mez', name: 'Meezan Bank' }, { id: 'b-hbl', name: 'HBL Current' }]
const TODAY = '2026-07-26'

type Expect = { amount?: number; date?: string; account?: string; paidBy?: 'cash' | 'bank'; bank?: string }

const CASES: [string, Expect][] = [
  // The headline example
  ['paid 5000 cash for office rent yesterday', { amount: 5000, date: '2026-07-25', account: 'a-rent', paidBy: 'cash' }],

  // Amount forms
  ['paid 5 hazar for electricity bill', { amount: 5000, account: 'a-util' }],
  ['rent 25000 today', { amount: 25000, account: 'a-rent', date: TODAY }],
  ['five thousand rupees salary', { amount: 5000, account: 'a-sal' }],
  ['paid rs 1200 for stationery', { amount: 1200, account: 'a-print' }],
  ['1.5 lakh salaries paid', { amount: 150000, account: 'a-sal' }],
  ['ek lakh ka rent diya', { amount: 100000, account: 'a-rent' }],
  ['paid 2,500 for internet bill', { amount: 2500, account: 'a-tel' }],
  ['das hazar transport ka kharcha', { amount: 10000, account: 'a-tran' }],

  // Dates
  ['bijli ka bill 3000 kal', { amount: 3000, account: 'a-util', date: '2026-07-25' }],
  ['paid 800 for repair 3 days ago', { amount: 800, account: 'a-rep', date: '2026-07-23' }],
  ['commission 4000 on 12 january 2026', { amount: 4000, account: 'a-comm', date: '2026-01-12' }],
  ['paid 900 bank charges 05/07/2026', { amount: 900, account: 'a-bank', date: '2026-07-05' }],

  // Payment method and bank
  ['transferred 15000 from meezan for rent', { amount: 15000, account: 'a-rent', paidBy: 'bank', bank: 'b-mez' }],
  ['paid 700 cash for photocopy', { amount: 700, account: 'a-print', paidBy: 'cash' }],
  ['salary 30000 paid online', { amount: 30000, account: 'a-sal', paidBy: 'bank' }],

  // Roman Urdu / mixed
  ['kiraya 20000 naqad diya', { amount: 20000, account: 'a-rent', paidBy: 'cash' }],
  ['tankhwah 45 hazar', { amount: 45000, account: 'a-sal' }],
  ['marammat ka kharcha 6500', { amount: 6500, account: 'a-rep' }],
]

let pass = 0
const failures: string[] = []

for (const [sentence, want] of CASES) {
  const got = parseExpense(sentence, { today: TODAY, accounts: ACCOUNTS, banks: BANKS })
  const problems: string[] = []
  if (want.amount !== undefined && got.amount !== want.amount) problems.push(`amount ${got.amount} ≠ ${want.amount}`)
  if (want.date !== undefined && got.date !== want.date) problems.push(`date ${got.date} ≠ ${want.date}`)
  if (want.account !== undefined && got.accountId !== want.account) problems.push(`account ${got.accountId} ≠ ${want.account}`)
  if (want.paidBy !== undefined && got.paidBy !== want.paidBy) problems.push(`paidBy ${got.paidBy} ≠ ${want.paidBy}`)
  if (want.bank !== undefined && got.bankId !== want.bank) problems.push(`bank ${got.bankId} ≠ ${want.bank}`)

  if (problems.length === 0) pass++
  else failures.push(`  "${sentence}"\n     ${problems.join('; ')}`)
}

// A spelled-out amount must not survive into the description. Caught live on
// production: "das hazar ka bijli ka bill" produced "Das bijli bill".
const descCases: [string, string][] = [
  ['das hazar ka bijli ka bill naqad diya kal', 'Bijli bill'],
  ['ek lakh ka rent diya', 'Rent'],
  ['paid 5000 cash for office rent yesterday', 'Office rent'],
]
const descFailures = descCases
  .map(([s, want]) => [s, want, parseExpense(s, { today: TODAY, accounts: ACCOUNTS, banks: BANKS }).description] as const)
  .filter(([, want, got]) => got !== want)
  .map(([s, want, got]) => `  "${s}"\n     description "${got}" ≠ "${want}"`)

if (descFailures.length) console.log('DESCRIPTION FAILURES:\n' + descFailures.join('\n'))

// A description is required by the form, so the parser must never leave it blank
// when it identified an account.
const blankDesc = CASES
  .map(([s]) => parseExpense(s, { today: TODAY, accounts: ACCOUNTS, banks: BANKS }))
  .filter((p) => p.accountId && !p.description).length

console.log(`Voice parser: ${pass}/${CASES.length} passed`)
if (failures.length) console.log('FAILURES:\n' + failures.join('\n'))
console.log(`blank descriptions where an account was found: ${blankDesc}`)
process.exit(failures.length === 0 && blankDesc === 0 && descFailures.length === 0 ? 0 : 1)
