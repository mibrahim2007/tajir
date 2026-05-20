import { db } from '@/db'
import type { ActionResult } from '@/lib/types'

const SERIALIZATION_FAILURE_CODE = '40001'
const MAX_RETRIES = 3

export async function withSerializable<T>(
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await db.transaction(fn, { isolationLevel: 'serializable' })
      return result
    } catch (err) {
      const pgCode = (err as { code?: string }).code
      if (pgCode === SERIALIZATION_FAILURE_CODE) {
        lastError = err
        // Brief back-off before retry
        await new Promise((r) => setTimeout(r, attempt * 50))
        continue
      }
      throw err
    }
  }

  // All retries exhausted — serialization conflict persists
  void lastError
  return { success: false, error: 'Conflict, please retry', code: 'SERIALIZATION_FAILURE' }
}
