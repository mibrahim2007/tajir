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

// Mirrors the engine's real precedence: faq index → comparative → guide → faq → data.
function route(q: string): string {
  const l = q.toLowerCase()
  if (FAQ_INDEX_KEYWORDS.some((k) => l.includes(k))) return 'faq-index'
  if (isComparativeQuestion(l)) { const c = matchFaq(l); if (c) return `faq:${c.id}` }
  const g = matchGuide(l)
  if (g) return `guide:${g.id}`
  const f = matchFaq(l)
  if (f) return `faq:${f.id}`
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

// Structural checks on the content itself
const ids = new Set(FAQS.map((f) => f.id))
const dupIds = ids.size !== FAQS.length
const badCat = FAQS.filter((f) => !FAQ_CATEGORIES.includes(f.category))
const noKeywords = FAQS.filter((f) => f.keywords.length === 0)
const longAnswers = FAQS.filter((f) => f.answer.length > 320)

console.log(`Routing: ${pass}/${CASES.length} passed`)
if (failures.length) console.log('FAILURES:\n' + failures.join('\n'))
console.log(`FAQs: ${FAQS.length} across ${FAQ_CATEGORIES.length} categories`)
console.log(`duplicate ids: ${dupIds} | bad category: ${badCat.length} | no keywords: ${noKeywords.length} | overlong answers: ${longAnswers.length}`)
process.exit(failures.length === 0 && !dupIds && !badCat.length && !noKeywords.length ? 0 : 1)
