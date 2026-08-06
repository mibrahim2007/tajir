// The Ask answer for "check my email": the last day of mail, triaged.
//
// Kept out of engine.ts because it is the one Ask intent that reads something
// other than the tenant's own database. Everything it shows is still derived,
// not inferred — each row carries the rule that put it where it is.

import { createAdminClient } from '@/lib/supabase/admin'
import { fetchRecentMessages } from '@/lib/inbox/imap'
import { buildRules, classifyInbox, countByCategory, type InboxCategory } from '@/lib/inbox/classify'
import type { AskResponse } from '@/lib/ask/types'

/** Comma-separated env override, e.g. INBOX_IMPORTANT_KEYWORDS="invoice,cheque". */
function envList(name: string): string[] | undefined {
  const raw = process.env[name]
  if (!raw) return undefined
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return list.length > 0 ? list : undefined
}

const HOURS = 24

/**
 * The prototype reads ONE mailbox from the environment, but the app is
 * multi-tenant — so without a guard, configuring a mailbox would show that
 * mailbox to all 29 tenants. That is a cross-tenant data leak, not a bug in
 * degree, so this fails closed: the mailbox is only ever served to the single
 * tenant named in INBOX_TENANT_ID, and if that is unset while IMAP is
 * configured, nobody gets it.
 *
 * Remove this when credentials become per-tenant and the mailbox is the
 * tenant's own rather than the server's.
 */
function mailboxBelongsTo(tenantId: string): boolean {
  const allowed = (process.env.INBOX_TENANT_ID || '').trim()
  return allowed !== '' && allowed === tenantId
}

export async function inboxAnswer(tenantId: string): Promise<AskResponse> {
  if (!mailboxBelongsTo(tenantId)) {
    return {
      kind: 'text',
      title: 'Mailbox',
      body: 'No mailbox is connected to this account.',
      suggestions: ['Stock summary', 'Who owes me money'],
    }
  }

  const fetched = await fetchRecentMessages(HOURS)

  if (!fetched.ok) {
    return {
      kind: 'text',
      title: 'Mailbox',
      body: fetched.error,
      suggestions: ['Stock summary', 'Who owes me money'],
    }
  }

  // What makes the same inbox sort differently per tenant: mail from someone
  // you actually trade with outranks mail from someone you do not.
  const admin = createAdminClient()
  const [{ data: customers }, { data: suppliers }] = await Promise.all([
    admin.from('tajir_customers').select('email').eq('tenant_id', tenantId).not('email', 'is', null).limit(2000),
    admin.from('suppliers').select('email').eq('tenant_id', tenantId).not('email', 'is', null).limit(2000),
  ])

  const knownParties = [...(customers ?? []), ...(suppliers ?? [])]
    .map((r) => (r.email ?? '').trim().toLowerCase())
    .filter(Boolean)

  const rules = buildRules({
    knownParties,
    importantKeywords: envList('INBOX_IMPORTANT_KEYWORDS'),
    ignoreKeywords:    envList('INBOX_IGNORE_KEYWORDS'),
    importantSenders:  envList('INBOX_IMPORTANT_SENDERS'),
    ignoreSenders:     envList('INBOX_IGNORE_SENDERS'),
  })

  const classified = classifyInbox(fetched.messages, rules)

  if (classified.length === 0) {
    return {
      kind: 'text',
      title: 'Mailbox',
      body: `Nothing arrived in ${fetched.mailbox} in the last ${HOURS} hours.`,
      suggestions: ['Stock summary', 'What is overdue'],
    }
  }

  const counts = countByCategory(classified)
  const badge: Record<InboxCategory, string> = {
    Important: 'Important',
    Information: 'Information',
    Ignore: 'Ignore',
  }

  return {
    kind: 'table',
    title: `Inbox — last ${HOURS} hours`,
    subtitle: `${fetched.mailbox} · sorted by the rules, not by a model`,
    summary: `${classified.length} message${classified.length === 1 ? '' : 's'}: ${counts.Important} important, ${counts.Information} informational, ${counts.Ignore} you can ignore.`,
    columns: [
      { key: 'category', label: 'Category' },
      { key: 'from',     label: 'From' },
      { key: 'subject',  label: 'Subject' },
      { key: 'received', label: 'Received', kind: 'date' },
      { key: 'why',      label: 'Why' },
    ],
    rows: classified.map((c) => ({
      category: badge[c.category],
      from:     c.message.fromName ? `${c.message.fromName} <${c.message.from}>` : c.message.from,
      subject:  c.message.subject,
      received: c.message.date,
      why:      c.reasons.slice(0, 2).join('; '),
    })),
    footer: `${counts.Important} important of ${classified.length}`,
    suggestions: ['Who owes me money', 'What is overdue', 'Stock summary'],
  }
}
