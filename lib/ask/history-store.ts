// Reading and writing the Ask question log.
//
// Server-only: this is the half of recall that touches the database. The
// matching rules live in ./history so they can be checked without one.

import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeQuestion, rankRecalls, type PastQuestion } from '@/lib/ask/history'
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
 * The answer to show when the engine could not match a question but this
 * tenant has asked something like it before.
 *
 * It deliberately does not answer the past question outright. Ask's contract is
 * that it reports what is recorded — silently swapping in a different question
 * would break that. It offers them instead, as tappable suggestions.
 */
export function recalledAnswer(question: string, recalls: PastQuestion[]): AskResponse | null {
  if (recalls.length === 0) return null

  return {
    kind: 'text',
    title: 'You have asked something like this before',
    body: `I could not match "${question.trim()}" to your data directly. These are questions from this account that came close — tap one to run it.`,
    suggestions: recalls.slice(0, 6).map((r) => r.question),
  }
}
