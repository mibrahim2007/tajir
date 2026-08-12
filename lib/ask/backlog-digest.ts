// Rendering the "Ask could not answer these" digest.
//
// The question log records every question and whether Ask could answer it. The
// unanswered ones are a to-do list written by the people using the software,
// and until now nobody found out about them until someone thought to look. This
// turns them into mail.
//
// Pure: no I/O, no server imports, so scripts/ask-digest-check.ts can run it.
// The route does the querying and the sending.

export type DigestRow = {
  tenant: string
  question: string
  /** Times this tenant asked it inside the window. */
  hits: number
}

export type Digest = { subject: string; html: string; text: string }

/**
 * Questions are typed by users and go into an HTML mail. Escaping them is not
 * optional: a question containing a tag would otherwise render as markup in the
 * recipient's mail client.
 */
export function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Group by tenant, most-asked first inside each — the priority order. */
function byTenant(rows: DigestRow[]): { tenant: string; questions: DigestRow[] }[] {
  const map = new Map<string, DigestRow[]>()
  for (const r of rows) {
    const list = map.get(r.tenant) ?? []
    list.push(r)
    map.set(r.tenant, list)
  }
  return [...map.entries()]
    .map(([tenant, questions]) => ({
      tenant,
      questions: [...questions].sort((a, b) => b.hits - a.hits || a.question.localeCompare(b.question)),
    }))
    .sort((a, b) => b.questions.length - a.questions.length || a.tenant.localeCompare(b.tenant))
}

/**
 * The digest, or null when there is nothing to report.
 *
 * Null matters more than it looks: this runs twice a day forever, and a mail
 * that says "nothing happened" twice a day trains you to ignore the one that
 * says something did.
 */
export function renderBacklogDigest(rows: DigestRow[], opts: { windowHours: number }): Digest | null {
  if (rows.length === 0) return null

  const groups = byTenant(rows)
  const total = rows.length
  const asked = rows.reduce((s, r) => s + r.hits, 0)
  const tenants = groups.length

  const subject =
    `Ask could not answer ${total} question${total === 1 ? '' : 's'}` +
    ` (${tenants} tenant${tenants === 1 ? '' : 's'}, last ${opts.windowHours}h)`

  const intro =
    `Ask logged ${total} distinct question${total === 1 ? '' : 's'} it could not answer` +
    ` in the last ${opts.windowHours} hours, asked ${asked} time${asked === 1 ? '' : 's'} in total.`

  const htmlGroups = groups
    .map((g) => {
      const items = g.questions
        .map((q) => `<li>${escapeHtml(q.question)}${q.hits > 1 ? ` <em>(asked ${q.hits}×)</em>` : ''}</li>`)
        .join('')
      return `<p><strong>${escapeHtml(g.tenant)}</strong> — ${g.questions.length}</p><ul>${items}</ul>`
    })
    .join('')

  const html = `
    <p>${escapeHtml(intro)}</p>
    ${htmlGroups}
    <hr/>
    <p><strong>What happens next.</strong> The scheduled backlog agent runs shortly after this
    mail. For anything it can honestly answer it opens a pull request describing the fix —
    that PR is the approval step, so merging it ships the answer and closing it rejects it.
    Questions that are out of scope for a trading application, or that need a report which
    does not exist, are deliberately left unanswered and named in the PR.</p>
    <p><a href="https://github.com/mibrahim2007/tajir/pulls">Open pull requests →</a></p>
    <p style="color:#666;font-size:12px">Nothing was changed to produce this mail. It reports
    the ask_query_log table, and no mail is sent at all when nothing new was logged.</p>
  `.trim()

  const textGroups = groups
    .map((g) => {
      const items = g.questions.map((q) => `  - ${q.question}${q.hits > 1 ? `  (asked ${q.hits}x)` : ''}`).join('\n')
      return `${g.tenant} — ${g.questions.length}\n${items}`
    })
    .join('\n\n')

  const text = [
    intro,
    '',
    textGroups,
    '',
    '---',
    'What happens next. The scheduled backlog agent runs shortly after this mail.',
    'For anything it can honestly answer it opens a pull request describing the fix —',
    'that PR is the approval step, so merging it ships the answer and closing it rejects it.',
    'Questions out of scope, or needing a report that does not exist, are left unanswered',
    'and named in the PR.',
    '',
    'https://github.com/mibrahim2007/tajir/pulls',
  ].join('\n')

  return { subject, html, text }
}
