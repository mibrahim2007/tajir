import type { ActionResult } from '@/lib/types'

// Shared result shapes for a failed `postJournalEntry`, so every money module
// reports a GL failure the same way instead of inventing its own wording.
//
// Two distinct situations, because the safe response differs:
//
//   CREATE — nothing existed before, so the half-written document is deleted
//            and the user is told nothing was saved. Clean state.
//
//   EDIT   — the document already existed and the user's changes are already
//            persisted. Deleting it would destroy their record, so we never do
//            that; we report loudly instead and say what to do about it.

export const GL_POST_FAILED = 'GL_POST_FAILED'

/** The document was rolled back; the books and the document are both unchanged. */
export function glCreateFailed(message: string): ActionResult<never> {
  return {
    success: false,
    error: `Could not post to the ledger, so nothing was saved: ${message}`,
    code: GL_POST_FAILED,
  }
}

/**
 * The document was saved but its ledger entry could not be re-posted.
 * `repostJournalEntry` has already put the PREVIOUS entry back, so the accounts
 * are intact but now show the pre-edit figures — stale, not missing.
 */
export function glEditFailed(message: string): ActionResult<never> {
  return {
    success: false,
    error:
      `Your changes were saved, but the ledger could not be updated: ${message}. ` +
      `The accounts still show this document's previous figures — save it again once the problem is resolved.`,
    code: GL_POST_FAILED,
  }
}
