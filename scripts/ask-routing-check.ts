// Ask routing check — run with `npm run check:ask`.
//
// The Ask page now has three answer layers (how-to guides, newcomer FAQs, and
// the data engine) sharing one input box. The failure mode is silent: a data
// question that starts returning instructions, or a concept question that
// returns an empty ledger, both look like working software. This pins the
// boundary with the phrasings that actually broke during development.
//
// Add a case whenever you add a keyword. It is not a full test suite — the repo
// has no test runner — but it is the check that matters most for this feature.

import { matchGuide } from '@/lib/ask/guides'
import { matchFaq, FAQS, FAQ_INDEX_KEYWORDS, FAQ_CATEGORIES, isComparativeQuestion } from '@/lib/ask/faq'
import { parseEmailCommand } from '@/lib/ask/email-command'
import { staticAliasFor } from '@/lib/ask/intents'

// Mirrors the engine's real precedence:
// faq index → comparative → guide → faq → static alias → data.
function route(q: string): string {
  const l = q.toLowerCase()
  if (FAQ_INDEX_KEYWORDS.some((k) => l.includes(k))) return 'faq-index'
  if (isComparativeQuestion(l)) { const c = matchFaq(l); if (c) return `faq:${c.id}` }
  const g = matchGuide(l)
  if (g) return `guide:${g.id}`
  const f = matchFaq(l)
  if (f) return `faq:${f.id}`
  // Last of the static layers: a bare word whose answer is a guide or an FAQ,
  // which the two matchers above cannot reach because both need a cue.
  const s = staticAliasFor(q)
  if (s) return s
  return 'data'
}

const CASES: [string, string][] = [
  // Newcomer questions must reach the FAQ
  ['i am new where do i start', 'faq:where_to_start'],
  ['what is an opening balance', 'faq:what_is_opening_balance'],
  ['do i need to know accounting', 'faq:need_accounting'],
  ['what is a location and do i need one', 'faq:what_is_location'],
  ['what is the difference between owner and assistant', 'faq:owner_vs_assistant'],
  ['why can i not see a menu item', 'faq:missing_menu'],
  ['why does it say insufficient stock', 'faq:insufficient_stock'],
  ['what is a service item', 'faq:service_item'],
  ['can i edit or delete an invoice', 'faq:edit_delete_invoice'],
  ['what are due days', 'faq:due_days'],
  ['a cheque bounced what do i do', 'faq:cheque_bounced'],
  ['can i give a customer cheque to a supplier', 'faq:endorse_cheque'],
  ['what is the chart of accounts', 'faq:chart_of_accounts'],
  ['what is opening balance equity', 'faq:opening_balance_equity'],
  ['why does my balance sheet not match', 'faq:balance_sheet_mismatch'],
  ['what is closing the books', 'faq:closing_books'],
  ['what is a voucher', 'faq:what_is_voucher'],
  ['difference between loan and advance', 'faq:loan_vs_advance'],
  ['how do i record money i take out of the business', 'faq:owner_money'],
  ['can i try things without messing up my real data', 'faq:safe_to_experiment'],
  ['what is the difference between a sale return and a credit note', 'faq:return_vs_credit_note'],
  ['what is the difference between a refund and a credit note', 'faq:refund_vs_note'],
  ['how do i record a part payment', 'faq:part_payment'],
  ['what do the aging buckets mean', 'faq:aging_meaning'],

  // Index phrases
  ['faq', 'faq-index'],
  ['common questions', 'faq-index'],
  ['help me get started', 'faq-index'],

  // How-to guides must still win over the FAQ
  ['how to create a sale invoice', 'guide:sale_invoice'],
  ['how to create a purchase order', 'guide:purchase_order'],
  ['what is pdc', 'guide:pdc_concept'],
  ['how to load customer opening balances', 'guide:opening_balance_customers'],
  ['how to load opening stock location wise', 'guide:opening_stock'],
  ['how to create a sale return', 'guide:sale_return'],

  // Bare words whose answer is static. Every one of these was typed on its own
  // and answered with the generic help card. Source: ask_query_log, 2026-08-07.
  ['start', 'faq:where_to_start'],
  ['how do i start', 'faq:where_to_start'],
  ['how to start', 'faq:where_to_start'],
  ['location', 'faq:what_is_location'],
  ['locations', 'faq:what_is_location'],
  // The guide's own title, offered as a chip in ASK_HOWTO_EXAMPLES — it carries
  // no how-to cue, so only the static alias reaches it.
  ['employee loans and advances', 'guide:employee_loans'],

  // Chart-of-accounts ledgers. "Cash in Hand" is account 1110 and belongs to no
  // party; this reached a supplier's ledger on production before the resolver
  // was fixed, so both halves are pinned — here, and in check:ask-resolve.
  ['cash in hand ledger', 'faq:account_ledger'],
  ['Show Chash in Hand Ledger', 'faq:account_ledger'],   // the question as typed
  ['show me cash in hand', 'faq:account_ledger'],
  ['general ledger', 'faq:account_ledger'],
  ['cashbook', 'faq:account_ledger'],
  ['what is cash in hand', 'faq:account_ledger'],
  // A named party still wins — "cash" must not swallow a real ledger question.
  ['ledger of Cash & Carry Mart', 'data'],

  // ...and the same words inside a real question must NOT be captured, which is
  // why static aliases match the whole question only.
  ['how to load opening stock location wise', 'guide:opening_stock'],
  ['ledger of Location Traders', 'data'],
  ['stock at location 2', 'data'],
  ['employee loan ledger of Rashid', 'data'],

  // Data questions must still reach the data engine
  ['who owes me money', 'data'],
  ['who do i owe', 'data'],
  ['top customers', 'data'],
  ['ledger of Ali Traders', 'data'],
  ['stock summary', 'data'],
  ['low stock items', 'data'],
  ['pending cheques', 'data'],
  ['overdue cheques', 'data'],
  ['cheque summary', 'data'],
  ['what is overdue', 'data'],
  ['slow moving items', 'data'],
  ['business summary of Abdul', 'data'],
  ['item ledger for cotton', 'data'],
  ['credit notes list', 'data'],
]

let pass = 0
const failures: string[] = []
for (const [q, expected] of CASES) {
  const got = route(q)
  if (got === expected) pass++
  else failures.push(`  "${q}"\n     expected ${expected}\n     got      ${got}`)
}

// ── Email commands ──────────────────────────────────────────────────
// parseEmailCommand runs BEFORE the engine (in askAction), so a false positive
// here silently mails an answer nobody asked to send, and a false negative just
// answers the question — which is why the "must stay a question" cases below
// matter more than the rest. Expected form: 'none', or 'target|question'.
function routeEmail(q: string): string {
  const c = parseEmailCommand(q)
  if (!c) return 'none'
  return `${c.target}|${c.question}${c.to ? `|${c.to}` : ''}`
}

const EMAIL_CASES: [string, string][] = [
  // Plain sends to self
  ['email me the ledger of Ali Traders', 'me|the ledger of Ali Traders'],
  ['email me top customers', 'me|top customers'],
  ['mail me stock summary', 'me|stock summary'],
  ['send me who owes me money', 'me|who owes me money'],
  ['e-mail me the cheque summary', 'me|the cheque summary'],
  ['email the stock summary', 'me|the stock summary'],
  ['email me a copy of the stock summary', 'me|the stock summary'],
  ['send me this business summary of Abdul', 'me|business summary of Abdul'],

  // Explicit recipients
  ['email the ledger of Ali Traders to accounts@example.com', 'other|the ledger of Ali Traders|accounts@example.com'],
  ['send stock summary to a@b.com, c@d.com', 'other|stock summary|a@b.com, c@d.com'],
  ['email the ledger of Ali Traders to me', 'me|the ledger of Ali Traders'],
  ['email the ledger of Star Traders to the customer', 'party|the ledger of Star Traders'],
  ['send the ledger of Metro Mills to the supplier', 'party|the ledger of Metro Mills'],

  // A party name containing " to " must survive — the tail is not a recipient
  ['email me the ledger of Top to Toe Traders', 'me|the ledger of Top to Toe Traders'],

  // Must NOT be treated as a send
  ['ledger of Ali Traders', 'none'],           // no email verb at all
  ['top customers', 'none'],
  ['email of Ali Traders', 'none'],            // asking for an address
  ['email address of Ali Traders', 'none'],
  ['sending charges ledger', 'none'],          // "sending" is not "send"
  ['mailtec ledger', 'none'],                  // party name starting with "mail"
  ['email', 'none'],                           // no question left
  ['email me', 'none'],
  ['what is overdue', 'none'],
  ['how to create a sale invoice', 'none'],
]

let emailPass = 0
for (const [q, expected] of EMAIL_CASES) {
  const got = routeEmail(q)
  if (got === expected) emailPass++
  else failures.push(`  [email] "${q}"\n     expected ${expected}\n     got      ${got}`)
}

// Structural checks on the content itself
const ids = new Set(FAQS.map((f) => f.id))
const dupIds = ids.size !== FAQS.length
const badCat = FAQS.filter((f) => !FAQ_CATEGORIES.includes(f.category))
const noKeywords = FAQS.filter((f) => f.keywords.length === 0)
const longAnswers = FAQS.filter((f) => f.answer.length > 320)

console.log(`Routing: ${pass}/${CASES.length} passed`)
console.log(`Email commands: ${emailPass}/${EMAIL_CASES.length} passed`)
if (failures.length) console.log('FAILURES:\n' + failures.join('\n'))
console.log(`FAQs: ${FAQS.length} across ${FAQ_CATEGORIES.length} categories`)
console.log(`duplicate ids: ${dupIds} | bad category: ${badCat.length} | no keywords: ${noKeywords.length} | overlong answers: ${longAnswers.length}`)
process.exit(failures.length === 0 && !dupIds && !badCat.length && !noKeywords.length ? 0 : 1)
