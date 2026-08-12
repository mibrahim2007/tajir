// Ask backlog triage — run with `npm run ask:backlog`.
//
// `npm run ask:history` writes what each tenant ASKED, one file per tenant, into
// docs/ask-queries. This reads those files back and says what would happen to
// each unanswered question TODAY. The distinction matters: the docs are a
// snapshot of ask_query_log at export time, so a question already fixed since
// then still sits in the "Unanswered" list and would be worked twice.
//
// It runs the PURE parts of the classifier only — the static layers, the alias
// table, the keyword maps and the intent families. Entity resolution needs the
// database and the tenant's own customer/supplier/item names, so a question that
// would resolve to a name shows as still open here. That is the safe direction
// to be wrong in: it over-reports work rather than declaring the backlog clear.
//
// Three statuses, and the middle one is the point of this script:
//
//   fixed    the engine now answers it — nothing to do
//   partial  it falls through to the engine's fallback, which OFFERS related
//            questions but does not answer. app/actions/ask.ts logs the ORIGINAL
//            response, so these keep coming back as unanswered in the next
//            export. A family offer improves the experience; it does not clear
//            the backlog entry.
//   open     nothing matches at all
//
//   npm run ask:backlog                    → every tenant
//   npm run ask:backlog -- ibrahim         → tenants whose file name matches
//   npm run ask:backlog -- --json          → machine-readable (the ask-curator agent reads this)
//   npm run ask:backlog -- --fail-on-open  → exit 1 while anything is still open

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { matchGuide, hasHowToCue, GUIDE_INDEX_KEYWORDS } from '@/lib/ask/guides'
import { matchFaq, hasFaqCue, FAQ_INDEX_KEYWORDS, isComparativeQuestion } from '@/lib/ask/faq'
import { aliasFor, staticAliasFor, familyFor, NONENTITY_KEYWORDS, SPECIFIC_KEYWORDS } from '@/lib/ask/intents'

const DOC_DIR = path.join(process.cwd(), 'docs', 'ask-queries')

type Status = 'fixed' | 'partial' | 'open'

/** Where the work goes when a question is still open. */
type Route = 'alias' | 'family' | 'guide' | 'faq' | 'keyword' | 'report'

type Entry = {
  tenant: string
  file: string
  question: string
  /** How many times this tenant asked it — the priority signal. */
  hits: number
  status: Status
  /** What answers it now, e.g. "faq:what_is_opening_balance". */
  route: string
  /** For open ones: which layer should absorb it. */
  suggest: Route | null
  why: string
}

// ── Reading the generated docs ──────────────────────────────────────

/** `- show last month sale  _(asked 3×)_` → the question and its hit count. */
const ITEM = /^-\s+(.+?)(?:\s+_\(asked (\d+)×\)_)?\s*$/

function parseTenantFile(file: string, text: string): { tenant: string; unanswered: { question: string; hits: number }[] } {
  const lines = text.split(/\r?\n/)
  const heading = lines.find((l) => l.startsWith('# ')) ?? ''
  // "# Ibrahim Mobile Shop — Ask questions" → "Ibrahim Mobile Shop"
  const tenant = heading.replace(/^#\s+/, '').replace(/\s+—\s+Ask questions\s*$/, '').trim() || file

  const unanswered: { question: string; hits: number }[] = []
  let inSection = false
  for (const line of lines) {
    if (line.startsWith('## ')) { inSection = line.startsWith('## Unanswered'); continue }
    if (!inSection) continue
    const m = ITEM.exec(line)
    if (!m) continue
    // The exporter escapes pipes so they do not break its markdown tables.
    const question = m[1].replace(/\\\|/g, '|').trim()
    if (question) unanswered.push({ question, hits: Number(m[2] ?? 1) || 1 })
  }
  return { tenant, unanswered }
}

// ── Replaying the classifier, offline ───────────────────────────────

/**
 * The non-entity half of the engine's intent scoring, with the same weights.
 *
 * Kept in step with runAsk() in lib/ask/engine.ts by hand — importing the engine
 * would drag in the server-only Supabase client, which is also why check:ask and
 * check:ask-analysis mirror rather than import it.
 */
function keywordIntent(lowerQ: string): string | null {
  const score = new Map<string, number>()
  const add = (id: string, n: number) => score.set(id, (score.get(id) ?? 0) + n)

  for (const [id, kws] of Object.entries(NONENTITY_KEYWORDS)) {
    for (const kw of kws) if (lowerQ.includes(kw)) add(id, 2)
  }
  for (const [id, kws] of Object.entries(SPECIFIC_KEYWORDS)) {
    for (const kw of kws) if (lowerQ.includes(kw)) add(id, 3)
  }
  // The cheque intent carries its own overdue filter, so the combined overdue
  // view is dropped when the question is cheque-specific — as the engine does.
  if (/cheque|cheques|pdc|post dated|post-dated/.test(lowerQ)) score.delete('overdue')

  let best: string | null = null
  let bestScore = 0
  for (const [id, s] of score) if (s > bestScore) { bestScore = s; best = id }
  return best
}

/**
 * What the engine would do with this question now, static layers first — the
 * same precedence as runAsk() and as scripts/ask-routing-check.ts.
 *
 * "check my email" is deliberately not covered: isInboxQuestion lives in a
 * module that imports the Supabase client, and an inbox question is never a
 * backlog item anyway.
 */
function classify(question: string): { status: Status; route: string } {
  const lowerQ = question.toLowerCase()

  if (GUIDE_INDEX_KEYWORDS.some((k) => lowerQ.includes(k))) return { status: 'fixed', route: 'guide-index' }
  if (FAQ_INDEX_KEYWORDS.some((k) => lowerQ.includes(k))) return { status: 'fixed', route: 'faq-index' }
  if (isComparativeQuestion(lowerQ)) {
    const compared = matchFaq(lowerQ)
    if (compared) return { status: 'fixed', route: `faq:${compared.id}` }
  }
  const guide = matchGuide(lowerQ)
  if (guide) return { status: 'fixed', route: `guide:${guide.id}` }
  const faq = matchFaq(lowerQ)
  if (faq) return { status: 'fixed', route: `faq:${faq.id}` }

  const staticAlias = staticAliasFor(question)
  if (staticAlias) return { status: 'fixed', route: `static:${staticAlias}` }

  const alias = aliasFor(question)
  if (alias) return { status: 'fixed', route: `alias:${alias}` }

  const keyword = keywordIntent(lowerQ)
  if (keyword) return { status: 'fixed', route: `keyword:${keyword}` }

  // The fallback that offers rather than answers. Logged as unanswered, so it
  // keeps its place in the backlog — see the header.
  const family = familyFor(question)
  if (family) return { status: 'partial', route: `family:${family.id}` }

  // A one- or two-word question with no family reaches the engine's name
  // search, which answers in both directions — it lists what matches, and says
  // plainly that nothing does when nothing does. Whether this tenant HAS a
  // record by that name cannot be known here, but either way it is answered.
  const words = lowerQ.split(/\s+/).filter(Boolean)
  if (words.length > 0 && words.length <= 2 && lowerQ.length >= 3) {
    return { status: 'fixed', route: 'search:name' }
  }

  return { status: 'open', route: 'none' }
}

/**
 * Which layer should absorb a question that nothing matches.
 *
 * A suggestion, not a decision — several of these are genuinely "a report that
 * does not exist yet", and only a person looking at the domain can tell.
 */
function suggestRoute(question: string): { suggest: Route; why: string } {
  const lowerQ = question.toLowerCase()
  const words = lowerQ.split(/\s+/).filter(Boolean).length

  if (hasHowToCue(lowerQ) && /^(how|steps|procedure|kaise|kese)/.test(lowerQ)) {
    return { suggest: 'guide', why: 'asks for steps — a guide in lib/ask/guides.ts' }
  }
  if (hasFaqCue(lowerQ)) {
    return { suggest: 'faq', why: 'asks what something is — an FAQ in lib/ask/faq.ts' }
  }
  if (words <= 2) {
    return { suggest: 'alias', why: 'a bare word — WHOLE_WORD_ALIASES if it names one report, INTENT_FAMILIES if it names an area' }
  }
  if (words <= 5) {
    return { suggest: 'keyword', why: 'a phrasing of an existing report — NONENTITY_KEYWORDS' }
  }
  return { suggest: 'report', why: 'no existing answer covers it — decide whether a new query is warranted' }
}

// ── Report ──────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2)
  const asJson = argv.includes('--json')
  const failOnOpen = argv.includes('--fail-on-open')
  const filter = (argv.find((a) => !a.startsWith('--')) ?? '').toLowerCase()

  let files: string[]
  try {
    files = (await readdir(DOC_DIR)).filter((f) => f.endsWith('.md') && f !== 'README.md')
  } catch {
    console.error(`No ${path.relative(process.cwd(), DOC_DIR)} directory. Run \`npm run ask:history\` first.`)
    process.exit(1)
  }

  const wanted = files.filter((f) => !filter || f.toLowerCase().includes(filter))
  if (wanted.length === 0) {
    console.error(filter ? `No tenant file matches "${filter}".` : 'No tenant files found — run `npm run ask:history`.')
    process.exit(1)
  }

  const entries: Entry[] = []
  for (const file of wanted) {
    const { tenant, unanswered } = parseTenantFile(file, await readFile(path.join(DOC_DIR, file), 'utf8'))
    for (const { question, hits } of unanswered) {
      const { status, route } = classify(question)
      const s = status === 'fixed' ? { suggest: null, why: '' } : suggestRoute(question)
      entries.push({ tenant, file, question, hits, status, route, suggest: s.suggest, why: s.why })
    }
  }

  // Most-asked first: three people hitting the same wall outranks a one-off.
  entries.sort((a, b) => b.hits - a.hits || a.question.localeCompare(b.question))

  const openish = entries.filter((e) => e.status !== 'fixed')

  if (asJson) {
    console.log(JSON.stringify({
      generatedFrom: path.relative(process.cwd(), DOC_DIR),
      tenants: wanted.length,
      counts: {
        total: entries.length,
        fixed: entries.filter((e) => e.status === 'fixed').length,
        partial: entries.filter((e) => e.status === 'partial').length,
        open: entries.filter((e) => e.status === 'open').length,
      },
      entries,
    }, null, 2))
    process.exit(failOnOpen && openish.length > 0 ? 1 : 0)
  }

  const byTenant = new Map<string, Entry[]>()
  for (const e of entries) {
    const list = byTenant.get(e.tenant) ?? []
    list.push(e)
    byTenant.set(e.tenant, list)
  }

  for (const [tenant, list] of byTenant) {
    const fixed = list.filter((e) => e.status === 'fixed').length
    console.log(`\n${tenant} — ${list.length} unanswered in the export, ${fixed} answered since`)
    console.log('-'.repeat(72))
    for (const e of list) {
      const asked = e.hits > 1 ? `  (asked ${e.hits}×)` : ''
      if (e.status === 'fixed') {
        console.log(`  fixed    ${pad(e.question)} → ${e.route}`)
      } else if (e.status === 'partial') {
        // A family is the RIGHT answer when several reports could honestly
        // answer — it offers instead of guessing. These stay in the backlog
        // permanently, because the log records the original unmatched response.
        console.log(`  partial  ${pad(e.question)} → ${e.route} — offers, does not answer${asked}`)
        console.log(`           correct if several reports could answer; make it ${article(e.suggest!).replace('add ', '')} ${e.suggest} only if exactly one can`)
      } else {
        console.log(`  OPEN     ${pad(e.question)}${asked}`)
        console.log(`           ${article(e.suggest!)} ${e.suggest}: ${e.why}`)
      }
    }
  }

  const counts = {
    fixed: entries.filter((e) => e.status === 'fixed').length,
    partial: entries.filter((e) => e.status === 'partial').length,
    open: entries.filter((e) => e.status === 'open').length,
  }
  console.log(
    `\n${entries.length} backlog question(s) across ${byTenant.size} tenant(s): ` +
    `${counts.fixed} now answered · ${counts.partial} only offered · ${counts.open} unmatched`,
  )
  if (counts.open > 0) {
    console.log('Work the OPEN rows first, most-asked first. Re-run `npm run ask:history` afterwards to refresh the export.')
  } else if (counts.partial > 0) {
    console.log(
      'Nothing unmatched. The "partial" rows name an area rather than one report, so they offer\n' +
      'instead of guessing — review that each still cannot be answered outright, but leaving them\n' +
      'as offers is a correct outcome, not unfinished work.',
    )
  }

  process.exit(failOnOpen && openish.length > 0 ? 1 : 0)
}

function pad(q: string): string {
  return q.length >= 34 ? q : q + ' '.repeat(34 - q.length)
}

function article(route: Route): string {
  return route === 'alias' ? 'add an' : 'add a'
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
