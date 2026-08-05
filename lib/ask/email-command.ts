// Typed "email me …" commands for the Ask box.
//
// This deliberately sits ABOVE the engine rather than inside it. The engine's
// classifier is a scored keyword match with a regression check behind it
// (`npm run check:ask`); adding an email intent to that scoring would put a new
// way for every existing question to be mis-routed. Here the directive is
// peeled off the front of the text first, and whatever remains is asked exactly
// as if it had been typed on its own.
//
// The bar for treating something as a command is deliberately high: it must
// START with an email verb. "ledger of Star" can never become a send.

export type EmailCommand = {
  /** The question with the email directive stripped off. */
  question: string
  /** Who to send to; 'party' means the customer/supplier the answer is about. */
  target: 'me' | 'party' | 'other'
  /** Raw recipient text, only when target is 'other'. */
  to?: string
}

// Must be the first word. `\b` keeps "mailtec" and "sending" from matching.
const CUE = /^(e-?mail|mail|send)\b[\s,:]*/i

// Filler between the verb and the question: "email me the ledger of X".
// Stripped repeatedly, because they stack — "send me this business summary of
// Abdul" carries two before the question starts.
const FILLER = /^(please\s+)?(me|myself|us|this|that|it|over|a\s+copy\s+of|copy\s+of|the\s+report\s+of|report\s+of)\b[\s,:]*/i

// "email of Ali Traders" is asking for an address, not asking to send. Anything
// starting this way is left to the normal engine.
const NOT_A_COMMAND = /^(of|address|addresses|id|ids)\b/i

// Recipient clauses that mean the party the answer is about.
const PARTY_WORDS = /^(the\s+)?(customer|supplier|party|client|vendor|them|him|her)$/i
const ME_WORDS = /^(me|myself|my\s+email|my\s+self|us)$/i

const ONE_EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

/** True when every token in the clause is an email address. */
function looksLikeAddressList(s: string): boolean {
  const parts = s.split(/[,;\s]+/).filter(Boolean)
  return parts.length > 0 && parts.every((p) => ONE_EMAIL.test(p))
}

/**
 * Split a trailing "to <recipient>" clause off the question.
 *
 * Scans from the LAST " to " backwards, and only accepts the clause when what
 * follows is recognisably a recipient. That way a party called "Top to Toe
 * Traders" keeps its name — the tail "Toe Traders" is neither an address nor a
 * recipient word, so the clause is left alone.
 */
function splitRecipient(text: string): { rest: string; target: EmailCommand['target']; to?: string } | null {
  const re = /\s+to\s+/gi
  const starts: number[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) starts.push(m.index)

  for (let i = starts.length - 1; i >= 0; i--) {
    const idx = starts[i]
    const before = text.slice(0, idx).trim()
    const after = text.slice(idx).replace(/^\s+to\s+/i, '').trim().replace(/[.?!]+$/, '')
    if (!after) continue
    if (ME_WORDS.test(after)) return { rest: before, target: 'me' }
    if (PARTY_WORDS.test(after)) return { rest: before, target: 'party' }
    if (looksLikeAddressList(after)) return { rest: before, target: 'other', to: after }
  }
  return null
}

/**
 * Parse a typed email command, or null when the text is an ordinary question.
 * Returns null rather than throwing on anything ambiguous — falling through to
 * a normal answer is always the safe outcome.
 */
export function parseEmailCommand(raw: string): EmailCommand | null {
  const text = (raw ?? '').trim()
  if (!text) return null

  const cue = CUE.exec(text)
  if (!cue) return null

  let rest = text.slice(cue[0].length).trim()
  if (!rest || NOT_A_COMMAND.test(rest)) return null

  // A recipient may be named before or after the filler is stripped, so pull it
  // off first: "email the ledger of Ali to accounts@x.com".
  const split = splitRecipient(rest)
  let target: EmailCommand['target'] = 'me'
  let to: string | undefined
  if (split) {
    rest = split.rest
    target = split.target
    to = split.to
  }

  const hadMeFiller = /^(please\s+)?(me|myself|us)\b/i.test(rest)
  // Bounded so a pathological input cannot spin here.
  for (let i = 0; i < 4; i++) {
    const next = rest.replace(FILLER, '').trim()
    if (next === rest) break
    rest = next
  }

  // "email me" on its own has nothing to ask; let the engine show its help.
  if (!rest) return null
  // "email me to someone@x.com" — a recipient but still no question.
  if (NOT_A_COMMAND.test(rest)) return null

  // No explicit recipient means the sender wants it themselves, which is also
  // what "email me …" says outright.
  if (!split && !hadMeFiller) target = 'me'

  return { question: rest, target, to }
}
