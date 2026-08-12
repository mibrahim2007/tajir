// Finding the customer, supplier or item a question names.
//
// Split out of engine.ts so it can be checked: engine.ts imports the Supabase
// admin client and cannot be loaded outside a server context, and this is the
// part of Ask whose failures are least visible. A mis-resolved name does not
// look like an error — it answers confidently about the wrong party.
//
// Free of I/O and of server imports, same as intents.ts and history.ts.

export type NamedEntity = { id: string; name: string; email?: string | null }

/**
 * Structural and intent words that must never resolve a party.
 *
 * The list exists so "top customers" cannot resolve a customer literally named
 * "Top Store", and so a question's grammar is not mistaken for a name.
 */
export const NAME_STOPWORDS = new Set([
  'ledger', 'statement', 'account', 'accounts', 'khata', 'movement', 'movements', 'history',
  'balance', 'balances', 'summary', 'overview', 'dealing', 'dealings', 'profile', 'business',
  'show', 'give', 'tell', 'get', 'find', 'list', 'the', 'and', 'for', 'from', 'with', 'all',
  'what', 'whats', 'which', 'who', 'whom', 'how', 'much', 'many', 'are', 'is', 'do', 'does',
  'my', 'me', 'our', 'total', 'report', 'detail', 'details', 'about', 'any', 'due', 'past',
  'customer', 'customers', 'supplier', 'suppliers', 'party', 'item', 'items', 'stock', 'inventory',
  'sale', 'sales', 'purchase', 'purchases', 'receivable', 'receivables', 'payable', 'payables',
  'payment', 'payments', 'receipt', 'receipts', 'cheque', 'cheques', 'pdc', 'overdue', 'money',
  'owe', 'owes', 'top', 'low', 'slow', 'best', 'pending', 'bounced', 'cleared', 'value', 'worth',
])

export const tokenize = (s: string): string[] => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

/**
 * Does a question word name part of this name?
 *
 * The word must START a word in the name. It used to be tested anywhere inside
 * the name, which is how "cash in hand ledger" answered with the ledger of a
 * supplier called "Chand MNC" — "chand" contains "hand". Nothing in the
 * question was about that supplier, the answer named it with no sign anything
 * had been guessed, and the engine's disambiguation guard could not help
 * because only ONE party matched: the guard fires on two or more.
 *
 * Prefix rather than whole-word, because partial naming is the point of this
 * pass: "bab" must still find "BABAR" and "star" must still find "Star
 * Technologies Pvt Ltd". What it gives up is a match in the middle of a word —
 * "traders" no longer finds "Alitraders" — which the explicit "search traders"
 * escape hatch still covers, and which is a far better trade than answering
 * about a party the user never mentioned.
 */
export function namePrefixMatch(nameTokens: string[], questionWord: string): boolean {
  return nameTokens.some((nt) => nt.startsWith(questionWord))
}

/** The question's content words — long enough and not structural. */
export function questionTokens(lowerQ: string): string[] {
  return tokenize(lowerQ).filter((t) => t.length >= 3 && !NAME_STOPWORDS.has(t))
}

/**
 * Find the entity named in the question, or null.
 *
 * Pass 1 is the whole name appearing in the question, longest wins — the
 * reliable case. Pass 2 is partial naming, scored in both directions and held
 * to a minimum so one short fragment cannot drag in an unrelated record.
 */
export function resolveEntity(lowerQ: string, list: NamedEntity[]): NamedEntity | null {
  // Pass 1 — the whole name appears in the question (most reliable).
  let best: NamedEntity | null = null
  for (const e of list) {
    const n = (e.name ?? '').trim().toLowerCase()
    if (n.length < 2) continue
    if (lowerQ.includes(n) && (!best || n.length > (best.name ?? '').length)) best = e
  }
  if (best) return best

  // Pass 2 — partial. Score each name by how much of the question's
  // non-stopword content it shares, in either direction.
  const qTokens = questionTokens(lowerQ)
  if (!qTokens.length) return null

  let bestScore = 0
  for (const e of list) {
    const nameLower = (e.name ?? '').toLowerCase()
    if (nameLower.length < 2) continue
    const nameTokens = tokenize(nameLower).filter((t) => t.length >= 2)
    let score = 0
    for (const qt of qTokens) {
      // Question word starts a word in the name — "star" → "Star Technologies".
      if (namePrefixMatch(nameTokens, qt)) score += qt.length
      // Name word starts the question word — the user typed a longer form.
      else if (nameTokens.some((nt) => nt.length >= 3 && qt.startsWith(nt))) score += 2
    }
    if (score > bestScore) { bestScore = score; best = e }
  }
  // Require a reasonably distinctive overlap (≥3 matched chars) so a single
  // short/common fragment can't pull in an unrelated party.
  return bestScore >= 3 ? best : null
}

/**
 * How many of these entities a question word could be naming.
 *
 * Used by the engine's disambiguation guard, and held to the SAME prefix rule
 * as resolveEntity — if the two disagreed, a word could resolve one party while
 * the guard counted none, which is exactly the hole "hand" fell through.
 */
export function countNameMatches(list: NamedEntity[], word: string): number {
  return list.filter((e) => namePrefixMatch(tokenize((e.name ?? '').toLowerCase()), word)).length
}
