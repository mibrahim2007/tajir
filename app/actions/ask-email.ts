'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { runAsk } from '@/lib/ask/engine'
import { sendAskAnswer } from '@/lib/ask/send-answer'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  /** The question to answer and send. Re-run here; see the note below. */
  question: z.string().min(1, 'Nothing to send'),
  /**
   * 'me'    → the signed-in user's own account address
   * 'party' → the customer/supplier the answer is about, looked up server-side
   * 'other' → the addresses typed into the box
   */
  target: z.enum(['me', 'party', 'other']),
  to: z.string().optional(),
  note: z.string().max(1000, 'Note is too long').optional(),
})

export type EmailAskResult = { to: string[] }

/**
 * Email the answer to an Ask question.
 *
 * The client sends the *question*, never the rows. Re-running `runAsk` here
 * costs one extra read and closes two holes at once: a caller cannot post
 * fabricated figures and have them delivered under the tenant's own name, and
 * cannot use the app as an open relay for arbitrary content. It also means the
 * recipient's copy is generated exactly the way the on-screen answer was.
 */
export async function emailAskAnswerAction(input: unknown): Promise<ActionResult<EmailAskResult>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { question, target, to, note } = parsed.data
  const { user, tenantId } = await requireAuth()
  const response = await runAsk(question)

  return sendAskAnswer({ response, question, target, to, note, user, tenantId })
}
