// Ask backlog digest check — run with `npm run check:ask-digest`.
//
// The digest is mail sent twice a day without anyone watching, so its two
// failure modes are both quiet: sending when there is nothing to say (which
// trains the reader to ignore it), and rendering a user-typed question straight
// into HTML (which is an injection into the operator's mail client).

import { renderBacklogDigest, escapeHtml, type DigestRow } from '@/lib/ask/backlog-digest'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

const rows: DigestRow[] = [
  { tenant: 'Ibrahim Mobile Shop', question: 'show cricket player score', hits: 1 },
  { tenant: 'Ibrahim Mobile Shop', question: '24', hits: 3 },
  { tenant: 'Makks International', question: 'show balance sheet', hits: 1 },
]

console.log('\n— Nothing to say means no mail —')
{
  check('an empty backlog renders nothing', renderBacklogDigest([], { windowHours: 13 }) === null)
}

console.log('\n— The digest says what happened —')
{
  const d = renderBacklogDigest(rows, { windowHours: 13 })!
  check('a digest is produced', d !== null)
  check('the subject counts the questions', d.subject.includes('3 questions'), d.subject)
  check('the subject counts the tenants', d.subject.includes('2 tenants'), d.subject)
  check('the body counts repeats', d.text.includes('asked 5 times'), d.text.split('\n')[0])
  check('both tenants appear', d.html.includes('Ibrahim Mobile Shop') && d.html.includes('Makks International'))
  check('a repeated question is marked', d.html.includes('asked 3×'))
  check('a once-asked question is not marked', !d.html.includes('asked 1×'))
  check('the PR approval step is explained', d.html.includes('pull request') && d.text.includes('pull request'))
}

console.log('\n— Singular and plural read correctly —')
{
  const one = renderBacklogDigest([{ tenant: 'Solo', question: 'x', hits: 1 }], { windowHours: 13 })!
  check('one question, one tenant', one.subject.includes('1 question (1 tenant'), one.subject)
  check('no stray plural', !one.subject.includes('questions'))
}

console.log('\n— A typed question cannot become markup —')
{
  // Questions are user input going into an HTML mail.
  const nasty: DigestRow[] = [
    { tenant: 'Ibrahim & Sons <Ltd>', question: '<img src=x onerror="alert(1)">', hits: 1 },
    { tenant: 'Ibrahim & Sons <Ltd>', question: `it's a "quoted" <b>thing</b>`, hits: 1 },
  ]
  const d = renderBacklogDigest(nasty, { windowHours: 13 })!
  check('no raw script-ish tag survives', !d.html.includes('<img'), d.html.includes('<img') ? 'LEAKED' : '')
  check('no raw bold tag survives', !d.html.includes('<b>'))
  check('the tag is escaped instead', d.html.includes('&lt;img'))
  check('the tenant name is escaped too', d.html.includes('Ibrahim &amp; Sons &lt;Ltd&gt;'))
  check('quotes are escaped', d.html.includes('&quot;') && d.html.includes('&#39;'))
  // The plain-text part is not markup, so it keeps the original wording.
  check('plain text keeps the question as typed', d.text.includes('<img src=x onerror="alert(1)">'))
}

console.log('\n— escapeHtml itself —')
{
  check('ampersand first, so escapes are not double-escaped',
    escapeHtml('<a & b>') === '&lt;a &amp; b&gt;', escapeHtml('<a & b>'))
  check('empty input is safe', escapeHtml('') === '')
}

console.log('\n— Most-asked first, biggest tenant first —')
{
  const d = renderBacklogDigest(rows, { windowHours: 13 })!
  const ibrahimAt = d.text.indexOf('Ibrahim Mobile Shop')
  const makksAt = d.text.indexOf('Makks International')
  check('the tenant with more questions leads', ibrahimAt < makksAt)
  check('the most-asked question leads its tenant',
    d.text.indexOf('- 24') < d.text.indexOf('- show cricket player score'))
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`)
process.exit(failures === 0 ? 0 : 1)
