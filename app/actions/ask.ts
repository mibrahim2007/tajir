'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { runAsk } from '@/lib/ask/engine'
import { parseEmailCommand } from '@/lib/ask/email-command'
import { sendAskAnswer } from '@/lib/ask/send-answer'
import { findSimilarQuestions, logAskQuestion, suggestionAnswer } from '@/lib/ask/history-store'
import { familyFor } from '@/lib/ask/intents'
import type { AskResponse } from '@/lib/ask/types'

// Answer a typed question purely from the tenant's own stored data. runAsk
// authenticates and scopes to the caller's tenant; there is no external model.
export async function askAction(question: string): Promise<AskResponse> {
  try {
    // "email me the ledger of Ali Traders" — send it, and still show the
    // answer, so the chat never just says "sent" with nothing to look at.
    // Parsing happens here rather than inside the engine so the engine's intent
    // scoring (and the check:ask regression cases) stay untouched.
    const command = parseEmailCommand(question)
    const effective = command?.question ?? question

    const answered = await runAsk(effective)
    const { user, tenantId } = await requireAuth()

    // Nothing matched. Two better options than the generic example list, in
    // order: what this tenant has asked before (known to work, and the
    // strongest clue about what they meant), then the reports covering the
    // area the question names — "month" alone cannot pick between monthly
    // sales, purchases and expenses, so it offers all three.
    let response = answered
    if (answered.unmatched) {
      const recalls = await findSimilarQuestions(tenantId, effective)
      response = suggestionAnswer(effective, recalls, familyFor(effective)) ?? answered
    }

    // Recorded against the ORIGINAL answer: a recalled suggestion list does not
    // mean the question was answered, and logging it as such would let an
    // unanswered question be recalled to someone else later.
    await logAskQuestion({ tenantId, userId: user.id, question: effective, response: answered })

    if (!command) return response

    // The answer above was just computed server-side, so it is passed straight
    // to the sender rather than re-querying for it. The ORIGINAL answer is what
    // gets sent — a recalled list of past questions carries no data to email,
    // and sendAskAnswer refuses it with a message saying so.
    const sent = await sendAskAnswer({
      response: answered,
      question: effective,
      target: command.target,
      to: command.to,
      user,
      tenantId,
    })

    return {
      ...response,
      asked: effective,
      emailed: sent.success ? { to: sent.data.to } : { to: [], failed: sent.error },
    }
  } catch {
    return {
      kind: 'text',
      body: 'Sorry — something went wrong reading your data for that one. Try rephrasing, or pick one of the examples.',
    }
  }
}
