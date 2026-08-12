// Entity resolution check — run with `npm run check:ask-resolve`.
//
// This pins the least visible failure Ask has. A mis-resolved name does not
// look like an error: the answer is well formed, it names a real party, and the
// figures in it are true — they are just about someone the user never asked
// about. Nothing on screen says a guess was made.
//
// The case that prompted the file, found on production for Makks International:
//
//   "cash in hand ledger"  →  "No ledger movements found for Chand MNC."
//
// "Cash in Hand" is chart-of-accounts 1110 and belongs to no party at all. It
// resolved to a supplier because the old rule tested each question word
// anywhere inside a name, and "chand" contains "hand". The disambiguation guard
// could not help: it fires on two or more matches, and only one party matched.

import { resolveEntity, countNameMatches, type NamedEntity } from '@/lib/ask/resolve'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

// Names taken from the tenants this was reproduced against, plus the shapes
// that must keep working.
const PARTIES: NamedEntity[] = [
  { id: '1', name: 'Chand MNC' },
  { id: '2', name: 'Chand Office' },
  { id: '3', name: 'Ali Traders & Co' },
  { id: '4', name: 'BABAR' },
  { id: '5', name: 'Star Technologies Pvt Ltd' },
  { id: '6', name: 'Top to Toe Traders' },
  // "Bharat" contains "rate" mid-word. Do NOT give this party a word actually
  // starting "rate" — that is a legitimate match and defeats the case below.
  { id: '7', name: 'Bharat Mills' },
  { id: '8', name: 'Smart Traders' },
]

const ITEMS: NamedEntity[] = [
  { id: 'i1', name: '10 GB CARD' },
  { id: 'i2', name: 'CPU' },
  { id: 'i3', name: 'Freight Charges' },
]

const resolved = (q: string, list = PARTIES) => resolveEntity(q, list)?.name ?? null

console.log('\n— A word inside a name is not a name —')
{
  // Every one of these is a real question about something that is not a party.
  const mustNotResolve: [string, string][] = [
    ['cash in hand ledger', '"hand" is inside "Chand"'],
    ['show chash in hand ledger', 'the typo the user actually typed'],
    ['cash in hand', 'without the ledger word'],
    ['what is the rate today', '"rate" is inside "Bharat"'],
    ['art supplies', '"art" is inside "Smart"'],
  ]
  for (const [q, why] of mustNotResolve) {
    check(`"${q}" resolves nobody — ${why}`, resolved(q) === null, resolved(q) ?? '')
  }
}

console.log('\n— Partial naming still works, which is the point of pass 2 —')
{
  const mustResolve: [string, string][] = [
    ['bab', 'BABAR'],                                   // from the question log
    ['baba', 'BABAR'],                                  // from the question log
    ['business summary of bab', 'BABAR'],
    ['star', 'Star Technologies Pvt Ltd'],
    ['ledger of star', 'Star Technologies Pvt Ltd'],
    ['ledger of Ali Traders & Co', 'Ali Traders & Co'], // pass 1, full name
    ['ledger of chand mnc', 'Chand MNC'],               // pass 1 beats the prefix rule
    ['chand', 'Chand MNC'],                             // a real prefix still resolves
  ]
  for (const [q, expected] of mustResolve) {
    check(`"${q}" → ${expected}`, resolved(q) === expected, resolved(q) ?? 'nobody')
  }
}

console.log('\n— Stopwords still cannot name a party —')
{
  // "top customers" must not resolve "Top to Toe Traders".
  check('"top customers" resolves nobody', resolved('top customers') === null, resolved('top customers') ?? '')
  check('"who owes me money" resolves nobody', resolved('who owes me money') === null, resolved('who owes me money') ?? '')
  check('"stock summary" resolves no item', resolveEntity('stock summary', ITEMS) === null)
}

console.log('\n— Items resolve the same way —')
{
  check('"card" finds the card item', resolveEntity('card', ITEMS)?.name === '10 GB CARD', resolveEntity('card', ITEMS)?.name ?? 'nobody')
  check('"charges" finds Freight Charges', resolveEntity('charges', ITEMS)?.name === 'Freight Charges', resolveEntity('charges', ITEMS)?.name ?? 'nobody')
  // "cpu" is three characters, so it survives the length filter.
  check('"cpu ledger" finds CPU', resolveEntity('cpu ledger', ITEMS)?.name === 'CPU', resolveEntity('cpu ledger', ITEMS)?.name ?? 'nobody')
}

console.log('\n— The guard counts what the resolver would resolve —')
{
  // If these two ever disagree, a word can resolve one party while the guard
  // counts none of them, and the engine commits to a guess unchallenged.
  check('"chand" matches both Chand parties', countNameMatches(PARTIES, 'chand') === 2, String(countNameMatches(PARTIES, 'chand')))
  check('"hand" matches nobody', countNameMatches(PARTIES, 'hand') === 0, String(countNameMatches(PARTIES, 'hand')))
  check('"traders" matches the three Traders', countNameMatches(PARTIES, 'traders') === 3, String(countNameMatches(PARTIES, 'traders')))

  // The invariant itself, over every word in every name plus the words that
  // caused the bug: anything the resolver resolves, the guard must count.
  const words = [...new Set([
    ...PARTIES.flatMap((p) => p.name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3)),
    'hand', 'rate', 'art', 'cash',
  ])]
  const broken = words.filter((w) => resolveEntity(w, PARTIES) !== null && countNameMatches(PARTIES, w) === 0)
  check('every resolvable word is counted by the guard', broken.length === 0, broken.join(' | ') || 'all agree')
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`)
process.exit(failures === 0 ? 0 : 1)
