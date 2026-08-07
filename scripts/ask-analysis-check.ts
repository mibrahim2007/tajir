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

import {
  WHOLE_WORD_ALIASES, NONENTITY_KEYWORDS, RUNNER_IDS, aliasFor,
  INTENT_FAMILIES, familyFor,
} from '@/lib/ask/intents'
import { matchGuide } from '@/lib/ask/guides'
import { matchFaq } from '@/lib/ask/faq'

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

console.log('\n— A vague word offers the reports instead of giving up —')
{
  // "month" was typed and matched nothing: every month-wise keyword is a full
  // phrase ("monthly sale"), so the bare word fell through to generic help
  // even though six reports could have answered some version of it.
  for (const q of ['month', 'monthly', 'month wise', 'this month', 'by month']) {
    const f = familyFor(q)
    check(`"${q}" offers the period reports`, f?.id === 'period', f?.id ?? 'nothing')
  }
  check('"comparison" offers comparisons', familyFor('comparison')?.id === 'comparison')
  // Straight from the log — a real user typed it this way.
  check('"comparision" (as typed) offers comparisons', familyFor('comparision')?.id === 'comparison')
  check('"show last month sale" offers the period reports', familyFor('show last month sale')?.id === 'period')
  check('"analysis" offers comparisons', familyFor('analysis')?.id === 'comparison')
  check('"grading" offers grading', familyFor('grading')?.id === 'grading')
  check('"performance" offers grading', familyFor('performance')?.id === 'grading')
  check('"report" offers the full menu', familyFor('report')?.id === 'reports')
  check('"profit" offers the money figures', familyFor('profit')?.id === 'money')
}

console.log('\n— "opening" reaches all four opening balances —')
{
  // Straight from the log: "opening", "opening balance" and "open" were each
  // typed and each fell through, even though the Opening Balances page has
  // four sections and Ask has a guide for three of them.
  for (const q of ['opening', 'opening balance', 'opening balances', 'opening stock', 'setup']) {
    check(`"${q}" offers the opening balances`, familyFor(q)?.id === 'opening', familyFor(q)?.id ?? 'nothing')
  }

  const opening = INTENT_FAMILIES.find((f) => f.id === 'opening')!
  const covers = (needle: string) => opening.offers.some((o) => o.toLowerCase().includes(needle))
  check('covers opening stock', covers('stock'))
  check('covers customers', covers('customer'))
  check('covers suppliers', covers('supplier'))
  check('covers cheques — the fourth section', covers('cheque'))

  // The cheque guide is new; the other three already existed.
  check('each opening offer resolves to a guide or FAQ',
    opening.offers.every((o) => !!matchGuide(o.toLowerCase()) || !!matchFaq(o.toLowerCase())),
    opening.offers.filter((o) => !matchGuide(o.toLowerCase()) && !matchFaq(o.toLowerCase())).join(' | ') || 'all resolve')
}

console.log('\n— "open" is NOT the same question as "opening" —')
{
  // Unsettled invoices versus setup. Sending someone asking about unpaid
  // invoices to a setup screen would be worse than the generic help.
  const open = familyFor('open')
  const opening = familyFor('opening')
  check('"opening" is the setup family', opening?.id === 'opening')
  check('"open" does not land in the setup family', open?.id !== 'opening', open?.id ?? 'no family')
}

console.log('\n— Every offer is a question the engine can actually answer —')
{
  // An offer that routes nowhere is worse than no offer: the user taps a
  // suggestion Ask itself produced and gets the generic fallback again.
  const answerable = (q: string) => {
    const lower = q.toLowerCase()
    if (aliasFor(q)) return true
    if (Object.values(NONENTITY_KEYWORDS).some((kws) => kws.some((k) => lower.includes(k)))) return true
    // Guides and FAQs are answers too — the opening-balance offers are all
    // how-to guides rather than data reports.
    if (matchGuide(lower)) return true
    if (matchFaq(lower)) return true
    // Placeholder offers ask the user to name something; they are prompts.
    return q.includes('<')
  }
  for (const family of INTENT_FAMILIES) {
    for (const offer of family.offers) {
      check(`"${offer}" is answerable`, answerable(offer))
    }
  }
}

console.log('\n— A cue never fires inside a real question —')
{
  // Families run only after the engine has failed, but a cue matching a
  // fragment of a longer word would still produce a nonsense suggestion.
  check('"yearly" does not match the "year" cue as a fragment',
    familyFor('yearlyrate') === null, familyFor('yearlyrate')?.id ?? 'null')
  check('a blank question has no family', familyFor('') === null)
  check('an unrelated question has no family', familyFor('zzz qqq') === null)
}

console.log('\n— The most specific family wins —')
{
  // "month wise comparison" contains cues from two families; the longer cue
  // decides, so the answer is about months rather than generic comparisons.
  const f = familyFor('month wise comparison')
  check('longest cue decides', f?.id === 'period', f?.id ?? 'nothing')
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`)
process.exit(failures === 0 ? 0 : 1)
