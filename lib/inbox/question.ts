// Deciding whether a typed question is about the mailbox.
//
// Free of server imports so the Ask engine, the answer builder and the check
// script can all share exactly one definition of what counts as an inbox
// question — the routing is the part most likely to go subtly wrong.

/** Cues that mean "triage my mailbox" rather than "email me this answer". */
export const INBOX_KEYWORDS = [
  'check my email', 'check my inbox', 'my inbox', 'my email', 'my emails',
  'read my email', 'read my inbox', 'inbox summary', 'email summary',
  'important emails', 'recent emails', 'triage', 'unread email',
  'emails today', 'email today', 'mail today',
]

/**
 * True for a mailbox question.
 *
 * "email me the stock summary" must NOT match — that is the send directive, and
 * showing someone their inbox when they pressed send would be its own bug. So a
 * bare "email"/"mail" is never a cue; only the phrasings above are, and an
 * explicit send directive is excluded outright.
 */
export function isInboxQuestion(question: string): boolean {
  const lowerQ = (question ?? '').trim().toLowerCase()
  if (/^\s*e?mail\s+(me|to|this)\b/.test(lowerQ)) return false
  return INBOX_KEYWORDS.some((k) => lowerQ.includes(k))
}
