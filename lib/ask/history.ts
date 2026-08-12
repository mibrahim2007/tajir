// Matching a new question against the ones a tenant has asked before.
//
// This is the "smart" part, and it is deliberately not a model. Ask's whole
// promise is that nothing is inferred, so recall works the way the rest of the
// engine does: normalise the text, compare it to what has actually been asked
// and answered before, and only offer a past question when the overlap is
// strong enough to stand behind.
//
// Free of server imports so the engine, the export script and the checks share
// one definition of "similar".

/** A past question, as returned by ask_similar_questions. */
export type PastQuestion = {
  question: string
  answerKind: string | null
  answerTitle: string | null
  /** How many times this tenant has asked it. */
  hits: number
  /** Trigram similarity from Postgres, 0..1. */
  score: number
}

/**
 * Words that carry no signal in a question about a business.
 *
 * Deliberately short. Dropping too much makes distinct questions collide —
 * "who owes me" and "who do I owe" differ almost entirely in stopwords, and
 * they are opposite questions.
 */
const NOISE = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
  'please', 'kindly', 'just', 'now', 'can', 'could', 'would', 'will',
  'show', 'tell', 'give', 'get', 'find', 'list', 'want', 'need',
])

/**
 * The form stored and compared: lowercased, punctuation stripped, whitespace
 * collapsed. Kept lossy but reversible enough that the original text is still
 * stored alongside for the reference file.
 */
export function normalizeQuestion(question: string): string {
  return (question ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')          // don't split "what's" into two tokens
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Content words of a question, noise removed. */
export function contentTokens(question: string): string[] {
  return normalizeQuestion(question)
    .split(' ')
    .filter((t) => t.length > 1 && !NOISE.has(t))
}

/**
 * How much two questions share, 0..1 — the proportion of the smaller question's
 * content words that appear in the other.
 *
 * Containment rather than Jaccard on purpose: "ledger of Ali Traders for last
 * month" contains "ledger of Ali Traders" completely, and should count as a
 * strong match even though it is twice the length.
 */
export function overlapScore(a: string, b: string): number {
  const ta = new Set(contentTokens(a))
  const tb = new Set(contentTokens(b))
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / Math.min(ta.size, tb.size)
}

/**
 * Below this a "did you mean" is more annoying than helpful — it puts words in
 * the user's mouth that they did not ask for.
 */
export const RECALL_THRESHOLD = 0.6

/**
 * Combine Postgres' trigram score with word overlap.
 *
 * Trigrams alone match on spelling, so "sale return" and "sales returns" score
 * well — good. But they also rate two unrelated questions of similar shape more
 * highly than they deserve. Requiring word overlap too means a suggestion has
 * to be about the same THING, not merely spelled alike.
 */
export function confidence(candidate: PastQuestion, question: string): number {
  const overlap = overlapScore(candidate.question, question)
  const trigram = Math.max(0, Math.min(1, candidate.score ?? 0))
  return overlap * 0.7 + trigram * 0.3
}

/**
 * The past questions worth offering, best first.
 *
 * A question the tenant has asked many times outranks a one-off at the same
 * confidence: it is more likely to be what they meant.
 */
export function rankRecalls(candidates: PastQuestion[], question: string): PastQuestion[] {
  const asked = normalizeQuestion(question)
  return candidates
    .filter((c) => normalizeQuestion(c.question) !== asked)
    .map((c) => ({ c, score: confidence(c, question) }))
    .filter(({ score }) => score >= RECALL_THRESHOLD)
    .sort((a, b) => b.score - a.score || b.c.hits - a.c.hits)
    .map(({ c }) => c)
}

/**
 * What to record as "answered with", for the exported question history.
 *
 * Table, stats, guide and FAQ answers all carry a title. A text answer usually
 * does not — "No ledger movements found for Ali Traders", "Nothing in your
 * records matches cards" — and storing null for those makes the history read
 * "Answered with: text", which hides the answers most worth reviewing: the
 * dead ends. A question answered with a sentence about nothing being found is
 * technically answered and genuinely unhelpful, and you cannot tell the two
 * apart from the word "text".
 *
 * This is how "cash in hand ledger" hid: it answered "No ledger movements found
 * for Chand MNC" — a party nobody asked about — and read as an ordinary
 * answered question in the export.
 */
export function answerLabel(response: { kind: string; title?: string | null; body?: string }): string | null {
  const titled = response.title ?? null
  if (titled) return titled
  if (response.kind === 'text' && response.body) {
    const body = response.body.trim().replace(/\s+/g, ' ')
    return body.length > 120 ? `${body.slice(0, 117)}…` : body
  }
  return null
}

/**
 * True when a past question is close enough that answering it outright is
 * better than asking "did you mean". Reserved for near-identical wording —
 * anything less and the user should choose.
 */
export function isConfidentMatch(candidate: PastQuestion, question: string): boolean {
  return confidence(candidate, question) >= 0.9
}
