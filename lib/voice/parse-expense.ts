// Turn a spoken sentence into a draft expense.
//
// "paid 5000 cash for office rent yesterday"
//   → amount 5000, cash, account 6200 Rent, date = yesterday, description "office rent"
//
// This is a deterministic parser, not a model. It looks for four things —
// amount, date, how it was paid, and which expense account — and hands back
// whatever it found plus what it could not place. The caller PRE-FILLS a form
// with the result; nothing is ever posted from a voice note directly. That is
// the whole safety design: a misheard word costs the user a glance, not a
// wrong entry in the ledger.
//
// Written for how the users actually talk: English, Roman Urdu, and the mix of
// the two ("5 hazar ka bijli ka bill").

export type ParsedExpense = {
  amount: number | null
  /** ISO yyyy-mm-dd, resolved against the caller's `today`. */
  date: string | null
  accountId: string | null
  accountName: string | null
  bankId: string | null
  paidBy: 'cash' | 'bank' | null
  description: string
  /** Field-by-field, so the UI can show what was understood and what was guessed. */
  found: { amount: boolean; date: boolean; account: boolean; paidBy: boolean }
}

export type ExpenseAccount = { id: string; code: string; name: string }
export type BankOption = { id: string; name: string }

// ── Amount ──────────────────────────────────────────────────────────
// Multipliers first, because "5 hazar" and "five thousand" are the common
// forms; bare digits are the fallback.
const MULTIPLIERS: [RegExp, number][] = [
  [/\b(crore|karor|karoor|kror)\b/, 10_000_000],
  [/\b(lakh|lac|lakhs|lakch|lakh)\b/, 100_000],
  [/\b(thousand|hazar|hazaar|hazzar|hzar|k)\b/, 1_000],
  [/\b(hundred|sau|so)\b/, 100],
]

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  // Roman Urdu, the numbers people actually say out loud
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, panch: 5, paanch: 5, che: 6, chhe: 6, chay: 6,
  sat: 7, saat: 7, ath: 8, aath: 8, nau: 9, das: 10, dus: 10,
  bees: 20, bis: 20, tees: 30, chalees: 40, pachas: 50, pachaas: 50,
}

const MONTH_ALT = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec'

/**
 * Blanks out the numbers that belong to a date, so they cannot be mistaken for
 * the amount. Without this, "paid 900 bank charges 05/07/2026" reads the year
 * as the amount, because 2026 is the largest number in the sentence.
 */
function stripDateTokens(t: string): string {
  return t
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, ' ')
    .replace(new RegExp(`\\b\\d{1,2}\\s*(?:${MONTH_ALT})\\w*\\s*(?:20\\d{2})?`, 'g'), ' ')
    .replace(new RegExp(`\\b(?:${MONTH_ALT})\\w*\\s*\\d{1,2}\\b,?\\s*(?:20\\d{2})?`, 'g'), ' ')
    .replace(/\b\d+\s*(?:day|days|din)\s*(?:ago|pehle|pahle|before)\b/g, ' ')
}

/**
 * Reads the amount out of the sentence.
 *
 * Handles "5000", "5,000", "rs 5000", "5 hazar", "five thousand", "1.5 lakh"
 * and "ek lakh". A number written next to a multiplier scales it; a bare
 * number is taken as-is.
 */
export function parseAmount(text: string): number | null {
  const t = ` ${stripDateTokens(text.toLowerCase().replace(/,/g, ''))} `

  // A number (digits or a word) immediately followed by a multiplier.
  for (const [re, mult] of MULTIPLIERS) {
    const m = re.exec(t)
    if (!m) continue
    const before = t.slice(0, m.index).trim().split(/\s+/).pop() ?? ''
    const n = Number(before)
    if (Number.isFinite(n) && before !== '') return n * mult
    if (before in NUMBER_WORDS) return NUMBER_WORDS[before] * mult
    // "paid thousand" with nothing in front still means one of them.
    return mult
  }

  // Bare digits — prefer one that sits next to a currency word, else the
  // largest number in the sentence (a date fragment is usually smaller).
  const nearCurrency = t.match(/(?:rs\.?|rupees?|rupay|rupaye|pkr)\s*([0-9]+(?:\.[0-9]+)?)/)
    ?? t.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:rs\.?|rupees?|rupay|rupaye|pkr)/)
  if (nearCurrency) return Number(nearCurrency[1])

  const numbers = [...t.matchAll(/\b([0-9]+(?:\.[0-9]+)?)\b/g)].map((m) => Number(m[1]))
  if (numbers.length) return Math.max(...numbers)

  // Spelled out with no multiplier: "five hundred" is caught above, "fifty" here.
  for (const [w, v] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${w}\\b`).test(t)) return v
  }
  return null
}

// ── Date ────────────────────────────────────────────────────────────
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december']

const shift = (today: string, days: number): string => {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

/**
 * Resolves a spoken date against `today`.
 *
 * Note on "kal": in Urdu it means both yesterday and tomorrow. An expense is
 * something that already happened, so it is read as yesterday — and the UI
 * shows the resolved date so the user can correct it.
 */
export function parseDate(text: string, today: string): string | null {
  const t = text.toLowerCase()

  if (/\b(today|aaj|aj)\b/.test(t)) return today
  if (/\b(yesterday|kal|kl|guzashta)\b/.test(t)) return shift(today, -1)
  if (/\b(day before yesterday|parso|parson)\b/.test(t)) return shift(today, -2)

  const ago = t.match(/\b([0-9]+)\s*(day|days|din)\s*(ago|pehle|pahle|before)\b/)
  if (ago) return shift(today, -Number(ago[1]))

  // "12 january" / "january 12" / "12 jan 2026"
  const monthName = MONTHS.find((m) => t.includes(m.slice(0, 3)) && new RegExp(`\\b${m.slice(0, 3)}`).test(t))
  if (monthName) {
    const dayM = t.match(/\b([0-9]{1,2})\b/)
    if (dayM) {
      const yearM = t.match(/\b(20[0-9]{2})\b/)
      const year = yearM ? yearM[1] : today.slice(0, 4)
      const mm = String(MONTHS.indexOf(monthName) + 1).padStart(2, '0')
      const dd = String(Number(dayM[1])).padStart(2, '0')
      const iso = `${year}-${mm}-${dd}`
      if (!Number.isNaN(Date.parse(iso))) return iso
    }
  }

  // 12/01/2026 or 12-01-2026, read day-first as is normal locally.
  const numeric = t.match(/\b([0-9]{1,2})[/-]([0-9]{1,2})[/-](20[0-9]{2})\b/)
  if (numeric) {
    const iso = `${numeric[3]}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`
    if (!Number.isNaN(Date.parse(iso))) return iso
  }

  return null
}

// ── How it was paid ─────────────────────────────────────────────────
export function parsePaidBy(text: string): 'cash' | 'bank' | null {
  const t = text.toLowerCase()
  if (/\b(bank|cheque|check|online|transfer\w*|card|account se|banking)\b/.test(t)) return 'bank'
  if (/\b(cash|naqad|naqd|nakad|hath se|cash se)\b/.test(t)) return 'cash'
  return null
}

// ── Which expense account ───────────────────────────────────────────
// Spoken words on the left, a fragment of the account name on the right. The
// fragment is matched against the tenant's OWN chart, so a business that
// renamed "Utilities" to "Bills" still resolves as long as one of its words
// appears. Anything unmatched falls through to the word-overlap pass below.
const ACCOUNT_HINTS: { spoken: RegExp; nameFragment: string }[] = [
  { spoken: /\b(rent|kiraya|kiraaya|kraya)\b/, nameFragment: 'rent' },
  { spoken: /\b(electric\w*|bijli|bijlee|gas|water|utility|utilities|wapda|sui)\b/, nameFragment: 'utilit' },
  { spoken: /\b(salary|salaries|wages|wage|tankhwah|tankha|tnkhwah|pay ?roll)\b/, nameFragment: 'salar' },
  { spoken: /\b(freight|transport\w*|carriage|delivery|goods ?transport|mazdoori|labour|labor)\b/, nameFragment: 'transport' },
  { spoken: /\b(commission|kamission)\b/, nameFragment: 'commission' },
  { spoken: /\b(printing|stationery|stationary|paper|photocopy|print)\b/, nameFragment: 'stationer' },
  { spoken: /\b(phone|telephone|mobile|internet|wifi|net bill|ptcl)\b/, nameFragment: 'telephone' },
  { spoken: /\b(repair\w*|maintenance|marammat|fix|servicing)\b/, nameFragment: 'repair' },
  { spoken: /\b(bank charges?|bank fee|service charge)\b/, nameFragment: 'bank charge' },
  { spoken: /\b(interest|markup|mark-up|sood)\b/, nameFragment: 'interest' },
  { spoken: /\b(office|stationery|misc\w*)\b/, nameFragment: 'office' },
]

const STOP = new Set([
  'paid', 'pay', 'payed', 'spent', 'give', 'gave', 'diya', 'diye', 'kiya', 'ka', 'ki', 'ke', 'ko',
  'for', 'the', 'a', 'an', 'on', 'in', 'at', 'to', 'of', 'and', 'with', 'by', 'from', 'today',
  'yesterday', 'cash', 'bank', 'rupees', 'rupee', 'rs', 'pkr', 'expense', 'bill', 'aaj', 'kal',
  'hazar', 'thousand', 'lakh', 'crore', 'sau', 'hundred', 'naqad', 'se', 'mein', 'per',
])

export function matchAccount(text: string, accounts: ExpenseAccount[]): ExpenseAccount | null {
  const t = text.toLowerCase()
  const named = (frag: string) => accounts.find((a) => a.name.toLowerCase().includes(frag))

  // Pass 1 — a known spoken term maps onto an account name fragment.
  for (const h of ACCOUNT_HINTS) {
    if (!h.spoken.test(t)) continue
    const hit = named(h.nameFragment)
    if (hit) return hit
  }

  // Pass 2 — any distinctive word in the sentence appearing in an account name.
  const words = t.split(/[^a-z]+/).filter((w) => w.length >= 4 && !STOP.has(w))
  let best: ExpenseAccount | null = null
  let bestScore = 0
  for (const a of accounts) {
    const name = a.name.toLowerCase()
    let score = 0
    for (const w of words) if (name.includes(w)) score += w.length
    if (score > bestScore) { bestScore = score; best = a }
  }
  return bestScore >= 4 ? best : null
}

function matchBank(text: string, banks: BankOption[]): BankOption | null {
  const t = text.toLowerCase()
  let best: BankOption | null = null
  let bestLen = 0
  for (const b of banks) {
    const n = b.name.toLowerCase()
    // Match on the distinctive first word too, so "paid from meezan" finds
    // "Meezan Bank Ltd — Current".
    const first = n.split(/[^a-z]+/).find((w) => w.length >= 4) ?? ''
    const hit = (n.length >= 3 && t.includes(n)) || (first && t.includes(first))
    if (hit && n.length > bestLen) { bestLen = n.length; best = b }
  }
  return best
}

// "das hazar" is a spelled-out amount, so both words have to go together —
// otherwise the description reads "Das bijli bill". Stripping number words on
// their own is not safe: "do" and "sat" are also ordinary English words, and
// only the ones sitting in front of a multiplier are certainly part of an
// amount.
const SPELLED_AMOUNT = new RegExp(
  `\\b(${Object.keys(NUMBER_WORDS).join('|')})\\s+(thousand|hazar|hazaar|hazzar|lakh|lac|crore|karor|hundred|sau)\\b`,
  'gi',
)

/** Strips the parts already understood, leaving something usable as a description. */
function buildDescription(text: string, account: ExpenseAccount | null): string {
  const cleaned = text
    .replace(/\b(rs\.?|rupees?|rupay|rupaye|pkr)\b/gi, ' ')
    .replace(SPELLED_AMOUNT, ' ')
    .replace(/[0-9][0-9,.]*/g, ' ')
    .replace(/\b(thousand|hazar|hazaar|lakh|lac|crore|karor|hundred|sau)\b/gi, ' ')
    .replace(/\b(paid|pay|spent|gave|diya|kiya|today|yesterday|aaj|kal|parso|cash|naqad|bank|online|cheque|transfer)\b/gi, ' ')
    .replace(/\b(for|of|the|a|an|on|to|from|by|se|ka|ki|ke|mein)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (cleaned.length >= 3) return cleaned.replace(/^\w/, (c) => c.toUpperCase())
  // Nothing distinctive left — fall back to the account name so the required
  // description is never empty.
  return account ? account.name : ''
}

export function parseExpense(
  text: string,
  ctx: { today: string; accounts: ExpenseAccount[]; banks: BankOption[] },
): ParsedExpense {
  const raw = (text ?? '').trim()
  const amount = parseAmount(raw)
  const date = parseDate(raw, ctx.today)
  const paidBy = parsePaidBy(raw)
  const account = matchAccount(raw, ctx.accounts)
  const bank = paidBy === 'bank' ? matchBank(raw, ctx.banks) : null

  return {
    amount,
    date,
    accountId: account?.id ?? null,
    accountName: account?.name ?? null,
    bankId: bank?.id ?? null,
    paidBy,
    description: buildDescription(raw, account),
    found: {
      amount: amount !== null,
      date: date !== null,
      account: account !== null,
      paidBy: paidBy !== null,
    },
  }
}
