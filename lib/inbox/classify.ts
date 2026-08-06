// Sorting a mailbox into Important / Information / Ignore.
//
// Deterministic and explainable, to match how the rest of Ask works: every
// verdict carries the reasons that produced it, so a tenant can see why a
// message was pushed down rather than being told to trust a score. Nothing
// here talks to a network or a database — the caller supplies the messages and
// the rules, which is what makes it checkable (`npm run check:inbox`).

/** Where a message ends up. */
export type InboxCategory = 'Important' | 'Information' | 'Ignore'

/** The parts of a message the rules look at. */
export type InboxMessage = {
  /** Envelope sender, lowercased by the caller or here. */
  from: string
  fromName?: string | null
  subject: string
  /** ISO timestamp. */
  date: string
  /** Carries List-Unsubscribe / Precedence: bulk — i.e. a mailing. */
  isBulk?: boolean
  hasAttachment?: boolean
  unseen?: boolean
}

export type InboxRules = {
  /** Subject words that pull a message up. */
  importantKeywords: string[]
  /** Subject words that push it down. */
  ignoreKeywords: string[]
  /** Addresses or "@domain" suffixes that are always important. */
  importantSenders: string[]
  /** Addresses or "@domain" suffixes that are never important. */
  ignoreSenders: string[]
  /**
   * The tenant's own customers and suppliers. This is what makes the same
   * inbox sort differently for different tenants without anyone configuring
   * anything — mail from someone you actually trade with is business mail.
   */
  knownParties: string[]
}

/**
 * Defaults aimed at a trading business: money and goods movement matter,
 * marketing does not.
 */
export const DEFAULT_INBOX_RULES: InboxRules = {
  importantKeywords: [
    'invoice', 'payment', 'overdue', 'outstanding', 'due', 'cheque', 'check',
    'remittance', 'purchase order', 'p.o.', 'order', 'delivery', 'dispatch',
    'shipment', 'urgent', 'reminder', 'balance', 'statement', 'refund',
    'quotation', 'quote', 'contract', 'complaint', 'return',
  ],
  ignoreKeywords: [
    'newsletter', 'unsubscribe', 'webinar', 'sale ends', 'discount', 'offer',
    'promotion', 'deal', 'coupon', 'survey', 'follow us', 'social', 'digest',
    'notification settings', 'you may also like', 'recommended for you',
  ],
  importantSenders: [],
  ignoreSenders: ['@newsletter', '@mailer', '@marketing', '@notifications'],
  knownParties: [],
}

export type ClassifiedMessage = {
  message: InboxMessage
  category: InboxCategory
  score: number
  /** Why it landed where it did, most significant first. */
  reasons: string[]
}

const normalise = (v: string | null | undefined) => (v ?? '').trim().toLowerCase()

/** "Re:"/"Fwd:" means a thread someone is already in — rarely noise. */
function isReply(subject: string): boolean {
  return /^\s*(re|fwd?|aw|sv)\s*:/i.test(subject)
}

/** Matches a full address, or a bare "@domain" / "prefix" fragment. */
function senderMatches(from: string, patterns: string[]): string | null {
  const addr = normalise(from)
  for (const raw of patterns) {
    const p = normalise(raw)
    if (!p) continue
    if (p.includes('@') ? (addr === p || addr.endsWith(p)) : addr.includes(p)) return raw
  }
  return null
}

function keywordHits(subject: string, keywords: string[]): string[] {
  const s = normalise(subject)
  return keywords.filter((k) => k && s.includes(normalise(k)))
}

/** Automated senders: real mail, but nobody is waiting on a reply. */
function isNoReply(from: string): boolean {
  return /(^|[._-])(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounce)/i.test(normalise(from))
}

/**
 * Score one message and say why.
 *
 * The thresholds are deliberately blunt — this is a triage aid, not a verdict,
 * and a tenant scanning 24 hours of mail is better served by an obvious rule
 * they can argue with than a subtle one they cannot.
 */
export function classifyMessage(message: InboxMessage, rules: InboxRules = DEFAULT_INBOX_RULES): ClassifiedMessage {
  const reasons: string[] = []
  let score = 0

  // An explicit ignore-sender is absolute: no keyword rescues it.
  const ignoredSender = senderMatches(message.from, rules.ignoreSenders)
  if (ignoredSender) {
    return {
      message,
      category: 'Ignore',
      score: -100,
      reasons: [`sender matches the ignore list (${ignoredSender})`],
    }
  }

  const importantSender = senderMatches(message.from, rules.importantSenders)
  if (importantSender) {
    score += 4
    reasons.push(`sender is on the important list (${importantSender})`)
  }

  const party = senderMatches(message.from, rules.knownParties)
  if (party) {
    score += 3
    reasons.push('from a customer or supplier you trade with')
  }

  const importantWords = keywordHits(message.subject, rules.importantKeywords)
  if (importantWords.length > 0) {
    score += 3
    reasons.push(`subject mentions ${importantWords.slice(0, 3).map((w) => `"${w}"`).join(', ')}`)
  }

  const ignoreWords = keywordHits(message.subject, rules.ignoreKeywords)
  if (ignoreWords.length > 0) {
    score -= 3
    reasons.push(`subject looks like marketing (${ignoreWords.slice(0, 2).map((w) => `"${w}"`).join(', ')})`)
  }

  if (message.isBulk) {
    score -= 3
    reasons.push('sent as a bulk mailing')
  }

  if (isNoReply(message.from)) {
    score -= 2
    reasons.push('automated no-reply sender')
  }

  if (isReply(message.subject)) {
    score += 1
    reasons.push('part of an existing thread')
  }

  if (message.hasAttachment) {
    score += 1
    reasons.push('has an attachment')
  }

  const category: InboxCategory = score >= 3 ? 'Important' : score >= 0 ? 'Information' : 'Ignore'
  if (reasons.length === 0) reasons.push('nothing stood out either way')

  return { message, category, score, reasons }
}

/** Newest first within each category, most important category first. */
const ORDER: Record<InboxCategory, number> = { Important: 0, Information: 1, Ignore: 2 }

export function classifyInbox(
  messages: InboxMessage[],
  rules: InboxRules = DEFAULT_INBOX_RULES,
): ClassifiedMessage[] {
  return messages
    .map((m) => classifyMessage(m, rules))
    .sort((a, b) =>
      ORDER[a.category] - ORDER[b.category] ||
      b.score - a.score ||
      (b.message.date ?? '').localeCompare(a.message.date ?? ''))
}

export function countByCategory(classified: ClassifiedMessage[]): Record<InboxCategory, number> {
  const counts: Record<InboxCategory, number> = { Important: 0, Information: 0, Ignore: 0 }
  for (const c of classified) counts[c.category]++
  return counts
}

/**
 * Merge tenant overrides onto the defaults. Keyword lists REPLACE rather than
 * extend when supplied, so a tenant who wants a short list can have one;
 * anything omitted keeps the default.
 */
export function buildRules(overrides: Partial<InboxRules> = {}): InboxRules {
  return {
    importantKeywords: overrides.importantKeywords?.length ? overrides.importantKeywords : DEFAULT_INBOX_RULES.importantKeywords,
    ignoreKeywords:    overrides.ignoreKeywords?.length    ? overrides.ignoreKeywords    : DEFAULT_INBOX_RULES.ignoreKeywords,
    importantSenders:  overrides.importantSenders ?? DEFAULT_INBOX_RULES.importantSenders,
    ignoreSenders:     overrides.ignoreSenders    ?? DEFAULT_INBOX_RULES.ignoreSenders,
    knownParties:      overrides.knownParties     ?? DEFAULT_INBOX_RULES.knownParties,
  }
}
