'use server'

import { runAsk } from '@/lib/ask/engine'
import type { AskResponse } from '@/lib/ask/types'

// Answer a typed question purely from the tenant's own stored data. runAsk
// authenticates and scopes to the caller's tenant; there is no external model.
export async function askAction(question: string): Promise<AskResponse> {
  try {
    return await runAsk(question)
  } catch {
    return {
      kind: 'text',
      body: 'Sorry — something went wrong reading your data for that one. Try rephrasing, or pick one of the examples.',
    }
  }
}
