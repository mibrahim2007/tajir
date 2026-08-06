// Inbox triage check — run with `npm run check:inbox`.
//
// Two things are pinned here. First, the routing: "email me the stock summary"
// is a SEND directive and must never be mistaken for "check my email", or
// pressing send would show someone their inbox instead. Second, the rules —
// what makes a message Important, Information or Ignore, and the guarantee that
// every verdict can explain itself.
//
// No mailbox and no credentials: the classifier and the router are pure.

import {
  classifyMessage, classifyInbox, countByCategory, buildRules,
  DEFAULT_INBOX_RULES, type InboxMessage,
} from '@/lib/inbox/classify'
import { isInboxQuestion } from '@/lib/inbox/question'
import { parseHeaders, looksBulk } from '@/lib/inbox/headers'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

const now = new Date().toISOString()
const msg = (over: Partial<InboxMessage> = {}): InboxMessage => ({
  from: 'someone@example.com', subject: 'Hello', date: now, ...over,
})

const categoryOf = (m: InboxMessage, rules = DEFAULT_INBOX_RULES) => classifyMessage(m, rules).category

console.log('\n— Routing: a send directive is not an inbox question —')
{
  for (const q of ['email me the stock summary', 'email me who owes me money', 'mail me the ledger of babar', 'email this answer']) {
    check(`"${q}" is NOT an inbox question`, !isInboxQuestion(q))
  }
  for (const q of ['check my email', 'check my inbox', 'my emails', 'inbox summary', 'important emails', 'what came in my inbox today']) {
    check(`"${q}" IS an inbox question`, isInboxQuestion(q))
  }
  for (const q of ['stock summary', 'who owes me money', 'ledger of babar', 'how to create a sale invoice']) {
    check(`"${q}" is left alone`, !isInboxQuestion(q))
  }
}

console.log('\n— Important —')
{
  check('an invoice', categoryOf(msg({ subject: 'Invoice INV-2043 attached' })) === 'Important')
  check('an overdue chase', categoryOf(msg({ subject: 'Payment overdue — please advise' })) === 'Important')
  check('a cheque', categoryOf(msg({ subject: 'Cheque no 0045123 ready for collection' })) === 'Important')

  const rules = buildRules({ knownParties: ['babar@textiles.pk'] })
  check('a customer you trade with, on any subject',
    categoryOf(msg({ from: 'babar@textiles.pk', subject: 'quick question' }), rules) === 'Important')
  check('a stranger with the same subject is not',
    categoryOf(msg({ from: 'nobody@example.com', subject: 'quick question' }), rules) !== 'Important')
}

console.log('\n— Ignore —')
{
  check('a bulk mailing', categoryOf(msg({ subject: 'Our spring newsletter', isBulk: true })) === 'Ignore')
  check('a promotion', categoryOf(msg({ subject: 'Huge discount — sale ends today' })) === 'Ignore')
  check('an ignore-listed sender',
    categoryOf(msg({ from: 'blast@marketing.example.com' }), buildRules({ ignoreSenders: ['@marketing.example.com'] })) === 'Ignore')
}

console.log('\n— The awkward cases —')
{
  // A real invoice sent through a bulk system must still surface: +3 keyword
  // against -3 bulk lands at 0, which is Information, not Ignore.
  const bulkInvoice = classifyMessage(msg({ subject: 'Your invoice is ready', isBulk: true }))
  check('a bulk-sent invoice is not buried in Ignore', bulkInvoice.category !== 'Ignore', bulkInvoice.category)

  // But a party you trade with beats the bulk penalty outright.
  const partyBulk = classifyMessage(
    msg({ from: 'babar@textiles.pk', subject: 'Invoice for last month', isBulk: true }),
    buildRules({ knownParties: ['babar@textiles.pk'] }))
  check('a trading partner outranks a bulk header', partyBulk.category === 'Important', partyBulk.category)

  // An explicit ignore-sender is absolute — no keyword rescues it.
  const suppressed = classifyMessage(
    msg({ from: 'noreply@spam.example', subject: 'URGENT invoice payment overdue' }),
    buildRules({ ignoreSenders: ['@spam.example'] }))
  check('the ignore list is not overridable by keywords', suppressed.category === 'Ignore', suppressed.category)

  check('a no-reply notification is not Important',
    categoryOf(msg({ from: 'no-reply@service.example', subject: 'Your account' })) !== 'Important')
}

console.log('\n— Every verdict explains itself —')
{
  const all = classifyInbox([
    msg({ subject: 'Invoice 12' }),
    msg({ subject: 'newsletter', isBulk: true }),
    msg({ subject: 'Hello there' }),
  ])
  check('reasons are always present', all.every((c) => c.reasons.length > 0))
  check('reasons are never empty strings', all.every((c) => c.reasons.every((r) => r.trim().length > 0)))
  check('the neutral case says so', classifyMessage(msg({ subject: 'Hello there' })).reasons[0].includes('nothing stood out'))
}

console.log('\n— Ordering and counts —')
{
  const sorted = classifyInbox([
    msg({ subject: 'newsletter', isBulk: true }),
    msg({ subject: 'Hello there' }),
    msg({ subject: 'Invoice 12 overdue' }),
  ])
  check('Important comes first', sorted[0].category === 'Important', sorted.map((s) => s.category).join(' > '))
  check('Ignore comes last', sorted[sorted.length - 1].category === 'Ignore')

  const counts = countByCategory(sorted)
  check('counts add up', counts.Important + counts.Information + counts.Ignore === sorted.length)
  check('an empty inbox counts to zero',
    Object.values(countByCategory(classifyInbox([]))).every((n) => n === 0))
}

console.log('\n— Tenant tuning —')
{
  const tuned = buildRules({ importantKeywords: ['shipment'] })
  check('a supplied keyword list replaces the default',
    categoryOf(msg({ subject: 'Shipment ready' }), tuned) === 'Important')
  check('and the defaults are gone',
    categoryOf(msg({ subject: 'Invoice 12' }), tuned) !== 'Important')
  check('an empty override keeps the defaults',
    buildRules({ importantKeywords: [] }).importantKeywords.length === DEFAULT_INBOX_RULES.importantKeywords.length)
}

console.log('\n— Header parsing (what marks a message as bulk) —')
{
  const folded = parseHeaders('List-Unsubscribe: <mailto:x@y.com>,\r\n <https://y.com/u>\r\nPrecedence: bulk')
  check('folded continuation lines are joined',
    (folded.get('list-unsubscribe') ?? '').includes('https://y.com/u'), folded.get('list-unsubscribe') ?? '')
  check('header names are case-insensitive', folded.get('precedence') === 'bulk')
  check('List-Unsubscribe marks bulk', looksBulk(folded))
  check('a plain header set does not', !looksBulk(parseHeaders('Subject: hi\r\nFrom: a@b.com')))
  check('empty input is safe', !looksBulk(parseHeaders(undefined)) && parseHeaders(null).size === 0)
  check('a Buffer parses the same as a string',
    parseHeaders(Buffer.from('List-Id: <a.b>')).get('list-id') === '<a.b>')
}

console.log('\n— The one mailbox is served to one tenant only —')
{
  // The prototype reads a single mailbox from the environment while the app is
  // multi-tenant, so the guard has to fail CLOSED: an unset allow-list must
  // mean "nobody", never "everybody".
  const mailboxBelongsTo = (tenantId: string) => {
    const allowed = (process.env.INBOX_TENANT_ID || '').trim()
    return allowed !== '' && allowed === tenantId
  }
  const TENANT = '3f8d456b-bdc9-4361-8f44-db1491e7076c'
  const OTHER  = '3be48df0-94f8-4c23-8048-1fae67b482e4'

  const prior = process.env.INBOX_TENANT_ID
  try {
    delete process.env.INBOX_TENANT_ID
    check('unset serves nobody', !mailboxBelongsTo(TENANT) && !mailboxBelongsTo(OTHER))

    process.env.INBOX_TENANT_ID = '   '
    check('blank serves nobody', !mailboxBelongsTo(TENANT))

    process.env.INBOX_TENANT_ID = TENANT
    check('the named tenant is served', mailboxBelongsTo(TENANT))
    check('every other tenant is not', !mailboxBelongsTo(OTHER))
  } finally {
    if (prior === undefined) delete process.env.INBOX_TENANT_ID
    else process.env.INBOX_TENANT_ID = prior
  }
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`)
process.exit(failures === 0 ? 0 : 1)
