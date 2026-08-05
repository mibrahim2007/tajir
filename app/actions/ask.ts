'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { runAsk } from '@/lib/ask/engine'
import { parseEmailCommand } from '@/lib/ask/email-command'
import { sendAskAnswer } from '@/lib/ask/send-answer'
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

    const response = await runAsk(effective)
    if (!command) return response

    // The answer above was just computed server-side, so it is passed straight
    // to the sender rather than re-querying for it.
    const { user, tenantId } = await requireAuth()
    const sent = await sendAskAnswer({
      response,
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
