// Reading and writing the Ask question log.
//
// Server-only: this is the half of recall that touches the database. The
// matching rules live in ./history so they can be checked without one.

import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeQuestion, rankRecalls, type PastQuestion } from '@/lib/ask/history'
import type { IntentFamily } from '@/lib/ask/intents'
import type { AskResponse } from '@/lib/ask/types'

/**
 * Record a question and how it was answered.
 *
 * Never throws and never blocks the answer: history is a convenience, and
 * failing to log one must not turn a working answer into an error.
 */
export async function logAskQuestion(opts: {
  tenantId: string
  userId?: string | null
  question: string
  response: AskResponse
}): Promise<void> {
  const question = (opts.question ?? '').trim()
  if (!question) return

  const title = 'title' in opts.response ? opts.response.title ?? null : null

  try {
    await createAdminClient()
      .from('ask_query_log')
      .insert({
        tenant_id:    opts.tenantId,
        user_id:      opts.userId ?? null,
        question,
        normalized:   normalizeQuestion(question),
        answer_kind:  opts.response.kind,
        answer_title: title,
        // The engine marks its own fallbacks; only answered questions are
        // worth recalling later.
        answered:     opts.response.unmatched !== true,
      })
  } catch (e) {
    console.error('[ask] failed to log question:', e)
  }
}

/** Past questions from THIS tenant that resemble the one just asked. */
export async function findSimilarQuestions(tenantId: string, question: string): Promise<PastQuestion[]> {
  const normalized = normalizeQuestion(question)
  if (!normalized) return []

  try {
    const { data, error } = await createAdminClient().rpc('ask_similar_questions', {
      p_tenant_id: tenantId,
      p_question:  normalized,
      p_limit:     8,
    })

    if (error || !data) return []

    const candidates: PastQuestion[] = (data as {
      question: string; answer_kind: string | null; answer_title: string | null; hits: number; score: number
    }[]).map((r) => ({
      question:    r.question,
      answerKind:  r.answer_kind,
      answerTitle: r.answer_title,
      hits:        Number(r.hits) || 0,
      score:       Number(r.score) || 0,
    }))

    return rankRecalls(candidates, question)
  } catch (e) {
    // A missing table or function must degrade to "no history", not an error.
    console.error('[ask] similar-question lookup failed:', e)
    return []
  }
}

/**
 * What to show when the engine could not match a question.
 *
 * This tenant's OWN past questions come first — they are the strongest signal
 * available about what the person meant, and they are already known to work.
 * Whatever the family offers is appended, so a brand new account with no
 * history still gets somewhere to go.
 *
 * It deliberately does not answer any of them outright. Ask's contract is that
 * it reports what is recorded — silently swapping in a different question would
 * break that. They are offered, not run.
 */
export function suggestionAnswer(
  question: string,
  recalls: PastQuestion[],
  family: IntentFamily | null,
): AskResponse | null {
  const asked = question.trim()
  const past = recalls.map((r) => r.question)
  // Family offers that are not already covered by the tenant's own history.
  const seen = new Set(past.map((p) => p.toLowerCase()))
  const offers = (family?.offers ?? []).filter((o) => !seen.has(o.toLowerCase()))

  if (past.length === 0 && offers.length === 0) return null

  // Both sources: lead with the tenant's own wording, then the rest.
  if (past.length > 0) {
    return {
      kind: 'text',
      title: family ? family.title : 'You have asked something like this before',
      body: offers.length > 0
        ? `You have asked these before — tap one to run it, or pick another below.`
        : `I could not match "${asked}" directly, but these questions from this account came close. Tap one to run it.`,
      suggestions: [...past.slice(0, 5), ...offers].slice(0, 9),
    }
  }

  // No `suggestions` here: a topics answer already renders its groups as
  // tappable chips, so repeating them below would show every offer twice.
  return {
    kind: 'topics',
    title: family!.title,
    subtitle: family!.subtitle,
    groups: [{ category: `"${asked}" could mean any of these`, questions: offers }],
  }
}
