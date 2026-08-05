// Ask email rendering check — run with `npm run check:ask-email`.
//
// The email body is built by string concatenation and is the one artefact
// nobody sees before a customer does. This renders both answer shapes offline
// and asserts the things that would be embarrassing in someone's inbox:
// unescaped names, "[object Object]" in a cell, a workbook that fails to build,
// or numbers that disagree with the chat.

import { buildAskWorkbook, renderAskEmailHtml, renderAskEmailText, askAttachmentName } from '@/lib/ask/email-format'
import type { AskResponse } from '@/lib/ask/types'

const failures: string[] = []
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures.push(`  ${name}${detail ? `\n     ${detail}` : ''}`)
}

// A party name with characters that must not reach the HTML raw.
const NASTY = 'Ali <script>alert(1)</script> & Sons "Traders"'

const table: AskResponse = {
  kind: 'table',
  title: `${NASTY} — ledger`,
  subtitle: '3 entries',
  columns: [
    { key: 'date', label: 'Date', kind: 'date' },
    { key: 'voucher', label: 'Voucher' },
    { key: 'debit', label: 'Debit', kind: 'money' },
    { key: 'credit', label: 'Credit', kind: 'money' },
    { key: 'balance', label: 'Balance', kind: 'money' },
  ],
  rows: [
    { date: '2026-02-03', voucher: 'SI-0012', debit: 45000, credit: 0, balance: 45000 },
    { date: '2026-03-11', voucher: 'RC-0004', debit: 0, credit: 20000, balance: 25000 },
    { date: null, voucher: '', debit: null, credit: 0, balance: 25000 },
  ],
  summary: `${NASTY} owes you PKR 25,000.00.`,
  footer: 'Closing balance: PKR 25,000.00 (owes you)',
  party: { type: 'customer', id: 'x', name: NASTY, email: 'ali@example.com' },
}

const stats: AskResponse = {
  kind: 'stats',
  title: 'Stock summary',
  subtitle: 'Inventory on hand',
  stats: [
    { label: 'Items', value: '42' },
    { label: 'Stock value', value: 'PKR 1,250,000.00' },
    { label: 'Out of stock', value: '3', tone: 'negative' },
  ],
  summary: '42 items worth about PKR 1,250,000.00.',
}

const opts = { tenantName: 'Ibrahim <b>Mobile</b> Shop', senderEmail: 'owner@example.com' }

// ── HTML ────────────────────────────────────────────────────────────
const html = renderAskEmailHtml({ ...opts, response: table, question: 'ledger of Ali', note: 'Please <check> this' })

check('table html renders', html.length > 500)
check('no unescaped script tag', !html.includes('<script>'), 'a party name reached the body raw')
check('party name is escaped', html.includes('&lt;script&gt;'))
check('tenant name is escaped', html.includes('Ibrahim &lt;b&gt;Mobile&lt;/b&gt; Shop'))
check('note is escaped', html.includes('Please &lt;check&gt; this'))
check('money is formatted, not raw', html.includes('45,000.00') && !/>45000</.test(html))
check('date is formatted', html.includes('3 Feb 2026'))
check('empty cells show a dash', html.includes('—'))
check('no undefined leaked', !html.includes('undefined'))
check('no [object Object]', !html.includes('[object Object]'))
check('footer present', html.includes('Closing balance'))
// Mail clients drop <style> blocks and classes; everything must be inline.
check('no class attributes', !/\sclass=/.test(html), 'mail clients ignore classes — use inline style')
check('no <style> block', !html.includes('<style'))

const statsHtml = renderAskEmailHtml({ ...opts, response: stats, question: 'stock summary' })
check('stats html renders', statsHtml.includes('Stock value') && statsHtml.includes('1,250,000.00'))
check('stats tone applied', statsHtml.includes('#b91c1c'), 'negative tone lost its colour')

// ── Plain text ──────────────────────────────────────────────────────
const text = renderAskEmailText({ ...opts, response: table, question: 'ledger of Ali' })
check('text has a row', text.includes('SI-0012'))
check('text has the footer', text.includes('Closing balance'))
check('text is not html', !text.includes('<td'))

// ── Attachment ──────────────────────────────────────────────────────
const name = askAttachmentName(table)
check('attachment name is slugged', /^[a-z0-9-]+\.xlsx$/.test(name), name)

const run = async () => {
  const wb = await buildAskWorkbook(table, 'ledger of Ali')
  check('table workbook builds', Boolean(wb && wb.length > 0))
  const st = await buildAskWorkbook(stats, 'stock summary')
  check('stats workbook builds', Boolean(st && st.length > 0))
  // A guide has nothing tabular to attach.
  const none = await buildAskWorkbook({ kind: 'text', body: 'hi' }, 'hi')
  check('non-data answer has no workbook', none === null)

  const total = 21
  console.log(`Ask email render: ${total - failures.length}/${total} checks passed`)
  if (failures.length) console.log('FAILURES:\n' + failures.join('\n'))
  process.exit(failures.length === 0 ? 0 : 1)
}

run()
