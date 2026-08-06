// Ask analysis routing check — run with `npm run check:ask-analysis`.
//
// Two separate risks are pinned here.
//
// ALIASES. Single bare words ("stock", "ledger", "customer") now route to a
// report, because the question log showed people typing exactly those and
// getting the generic help answer. Matched as substrings they would be a
// disaster — "ledger" appears in "ledger of Ali Traders", "customer" in almost
// every question naming one. So they only fire on the WHOLE question, and the
// cases below prove a named question still wins.
//
// ANALYSIS INTENTS. "monthly sales" is tenant-wide, but "monthly sales of
// <item>" is one item's breakdown, and the two must not be confused.
//
// The engine needs a database, so this checks the pure classifier inputs — the
// alias table and the keyword maps — the same way check:ask does for routing.

import { WHOLE_WORD_ALIASES, NONENTITY_KEYWORDS, RUNNER_IDS, aliasFor } from '@/lib/ask/intents'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

console.log('\n— The bare words from the log now route —')
{
  // Every one of these was typed by a real user and answered with the generic
  // help text. Source: ask_query_log, 2026-08-06.
  const fromLog: [string, string][] = [
    ['stock', 'stock_summary'],
    ['stock items', 'slow_items'],
    ['items', 'slow_items'],
    ['show item current stocks', 'slow_items'],
    ['summary', 'stock_summary'],
    ['ledger', 'receivables'],
    ['supplier', 'payables'],
    ['bounced', 'cheque_summary'],
  ]
  for (const [q, expected] of fromLog) {
    check(`"${q}" → ${expected}`, aliasFor(q) === expected, aliasFor(q) ?? 'no match')
  }
}

console.log('\n— Punctuation and case do not defeat an alias —')
{
  check('"Stock?" matches', aliasFor('Stock?') === 'stock_summary')
  check('"  stock  " matches', aliasFor('  stock  ') === 'stock_summary')
  check('"STOCK." matches', aliasFor('STOCK.') === 'stock_summary')
}

console.log('\n— A named question is NEVER hijacked by an alias —')
{
  // This is the whole reason aliases are whole-question only.
  const named = [
    'ledger of Ali Traders',
    'customer ledger for Babar',
    'supplier summary of Makks',
    'stock of 20s carded',
    'show me the ledger of Ahmad',
    'expense of last month',
    'sales of Babar Textiles',
  ]
  for (const q of named) {
    check(`"${q}" is not an alias`, aliasFor(q) === null, aliasFor(q) ?? '')
  }
}

console.log('\n— Every alias target is a real intent —')
{
  // A typo in an alias target would route a question into a runner that does
  // not exist, which surfaces as the generic fallback and looks like the alias
  // simply did not work.
  const known = new Set<string>(RUNNER_IDS)
  for (const id of Object.keys(WHOLE_WORD_ALIASES)) {
    check(`alias target "${id}" exists`, known.has(id))
  }
  for (const id of Object.keys(NONENTITY_KEYWORDS)) {
    check(`keyword target "${id}" exists`, known.has(id))
  }
}

console.log('\n— No alias is claimed by two intents —')
{
  const seen = new Map<string, string>()
  let clashes = 0
  for (const [id, aliases] of Object.entries(WHOLE_WORD_ALIASES)) {
    for (const a of aliases) {
      if (seen.has(a)) {
        console.log(`      "${a}" claimed by both ${seen.get(a)} and ${id}`)
        clashes++
      } else seen.set(a, id)
    }
  }
  // A clash is not fatal — the engine scores rather than picks — but it makes
  // the winner depend on object key order, which is not something to rely on.
  check('every alias belongs to exactly one intent', clashes === 0, `${clashes} clash(es)`)
}

console.log('\n— Analysis phrasings are covered —')
{
  const hits = (q: string) => Object.entries(NONENTITY_KEYWORDS)
    .filter(([, kws]) => kws.some((k) => q.toLowerCase().includes(k)))
    .map(([id]) => id)

  const expected: [string, string][] = [
    ['monthly sale comparison', 'monthly_sales'],
    ['sales by month', 'monthly_sales'],
    ['month wise purchase', 'monthly_purchases'],
    ['purchase comparison', 'monthly_purchases'],
    ['sales vs purchase', 'trade_comparison'],
    ['expense summary', 'expenses'],
    ['where is money going', 'expenses'],
    ['customer grading', 'customer_grades'],
    ['grade my suppliers', 'supplier_grades'],
    ['supplier performance', 'supplier_grades'],
  ]
  for (const [q, id] of expected) {
    check(`"${q}" reaches ${id}`, hits(q).includes(id), hits(q).join(',') || 'nothing')
  }
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`)
process.exit(failures === 0 ? 0 : 1)
