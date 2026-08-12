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
  INTENT_FAMILIES, familyFor, STATIC_ALIASES, staticAliasFor, singularize,
} from '@/lib/ask/intents'
import { GUIDES, matchGuide } from '@/lib/ask/guides'
import { FAQS, matchFaq } from '@/lib/ask/faq'

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
    // 2026-08-12: "suppliers" already routed, but the way it was actually typed
    // did not.
    ['all suppliers', 'payables'],
    ['all customers', 'top_customers'],
  ]
  for (const [q, expected] of fromLog) {
    check(`"${q}" → ${expected}`, aliasFor(q) === expected, aliasFor(q) ?? 'no match')
  }
}

console.log('\n— Bare words whose answer is a guide or an FAQ —')
{
  // matchGuide and matchFaq both need a how-to or concept cue, so a one-word
  // question can never reach them. These were typed alone and answered with the
  // generic help card while the answer sat in faq.ts. Source: ask_query_log.
  const fromLog: [string, string][] = [
    ['start', 'faq:where_to_start'],
    ['how do i start', 'faq:where_to_start'],
    ['location', 'faq:what_is_location'],
    ['locations', 'faq:what_is_location'],
    ['employee loans and advances', 'guide:employee_loans'],
  ]
  for (const [q, expected] of fromLog) {
    check(`"${q}" → ${expected}`, staticAliasFor(q) === expected, staticAliasFor(q) ?? 'no match')
  }

  check('"Location?" survives punctuation', staticAliasFor('Location?') === 'faq:what_is_location')

  // Whole question only — the same word inside a real question must not be
  // captured. "location" appears in a guide title; "start" in ordinary wording.
  for (const q of ['how to load opening stock location wise', 'stock at location 2', 'start a new invoice', 'ledger of Location Traders']) {
    check(`"${q}" is not a static alias`, staticAliasFor(q) === null, staticAliasFor(q) ?? '')
  }

  // Every target must exist, or the engine silently falls through to the data
  // layer and the question looks unanswered again.
  const faqIds = new Set(FAQS.map((f) => f.id))
  const guideIds = new Set(GUIDES.map((g) => g.id))
  for (const [q, target] of Object.entries(STATIC_ALIASES)) {
    const [layer, id] = target.split(':')
    const exists = layer === 'faq' ? faqIds.has(id) : layer === 'guide' ? guideIds.has(id) : false
    check(`"${q}" → ${target} exists`, exists)
  }
}

console.log('\n— A pluralised name still finds the item —')
{
  // "cards" matched nothing while "card" listed three items: stock names are
  // stored singular ("10 GB CARD") and every match is a substring test.
  const cases: [string, string | null][] = [
    ['cards', 'card'],
    ['laptops', 'laptop'],
    ['batteries', 'battery'],
    ['boxes', 'box'],
    ['watches', 'watch'],
    // Not plurals — leaving these alone matters more than catching every plural,
    // because the singular is only ever tried after the real word found nothing.
    ['card', null],
    ['business', null],
    ['address', null],
    ['gas', null],
    ['', null],
  ]
  for (const [word, expected] of cases) {
    check(`singularize("${word}") → ${expected ?? 'null'}`, singularize(word) === expected, String(singularize(word)))
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
  // "open" now has a family of its own — unpaid items, the opposite of setup.
  check('"open" offers the outstanding figures', open?.id === 'outstanding', open?.id ?? 'no family')
  check('"opening" is unaffected by the "open" cue', opening?.id === 'opening')
}

console.log('\n— The areas the log showed people naming bare —')
{
  // Each of these was typed on its own and matched nothing. None of them names
  // ONE report, so each offers rather than guesses — which means they stay in
  // the backlog as "offered, not answered", and that is the honest outcome.
  const cases: [string, string][] = [
    ['invoice', 'documents'],
    ['sale invoice', 'documents'],
    ['invoices', 'documents'],
    ['employee', 'staff'],
    ['employees', 'staff'],
    ['open', 'outstanding'],
  ]
  for (const [q, expected] of cases) {
    check(`"${q}" offers the ${expected} family`, familyFor(q)?.id === expected, familyFor(q)?.id ?? 'nothing')
  }

  // Ask has no invoice-list runner and no payroll report. If either is ever
  // built, these families should shrink to an alias — this comment is the note.
  const documents = INTENT_FAMILIES.find((f) => f.id === 'documents')!
  check('the invoice family offers the sale-invoice guide',
    documents.offers.some((o) => matchGuide(o.toLowerCase())?.id === 'sale_invoice'))
}

console.log('\n— Every offer is a question the engine can actually answer —')
{
  // An offer that routes nowhere is worse than no offer: the user taps a
  // suggestion Ask itself produced and gets the generic fallback again.
  const answerable = (q: string) => {
    const lower = q.toLowerCase()
    if (aliasFor(q)) return true
    if (staticAliasFor(q)) return true
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
