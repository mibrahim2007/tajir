import { createAdminClient } from '@/lib/supabase/admin'
import { postJournalEntry, type PostJournalEntryParams, type PostJournalEntryResult } from './post-journal-entry'
import { getLockedThrough, isLocked, formatLockDate } from './period-lock'

/**
 * Replaces the journal entry for a document that has just been edited.
 *
 * Every edit action used to do this by hand: read the old entry, delete it,
 * then post a new one — and none of them checked whether the post succeeded.
 * A failure therefore left the document with NO journal entry at all while the
 * action still reported success, so the books silently lost the transaction.
 *
 * This does the same sequence but SNAPSHOTS the old entry (header and lines)
 * first, so a failed re-post can put the ledger back exactly as it was. The
 * document itself keeps the user's edits — the GL is then stale rather than
 * missing, which is the lesser of the two wrongs and is reported to the caller.
 *
 * The original voucher number is always carried over, so an edit never renumbers
 * a voucher.
 */
export async function repostJournalEntry(
  params: Omit<PostJournalEntryParams, 'voucherNumber'>,
): Promise<PostJournalEntryResult> {
  const { tenantId, sourceType, sourceId } = params
  const admin = createAdminClient()

  const { data: oldEntry } = await admin
    .from('tajir_journal_entries')
    .select('id, voucher_number, date, description, reference')
    // `date` is also read to vet the lock below, not just to restore the entry.
    .eq('tenant_id', tenantId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .maybeSingle()

  // Snapshot the lines too — without these the old entry cannot be rebuilt.
  const { data: oldLines } = oldEntry
    ? await admin
        .from('tajir_journal_entry_lines')
        .select('account_id, description, debit, credit, customer_id, supplier_id, stock_item_id, employee_id, owner_id')
        .eq('journal_entry_id', oldEntry.id)
    : { data: null }

  // Refuse BEFORE deleting anything if either end of the move touches a closed
  // period: the entry's current date (removing it from closed books) or the new
  // date (posting into them). Checking after the delete would leave the document
  // with no entry at all when the re-post is then refused.
  const lockedThrough = await getLockedThrough(admin, tenantId)
  const blockedDate = isLocked(params.date, lockedThrough)
    ? params.date
    : oldEntry && isLocked(oldEntry.date as string, lockedThrough)
      ? (oldEntry.date as string)
      : null

  if (blockedDate) {
    const message = `The books are locked through ${formatLockDate(lockedThrough!)}; the entry dated ${blockedDate} cannot be changed`
    console.error(`[repostJournalEntry] period_locked: ${message} (${sourceType}/${sourceId})`)
    return { ok: false, reason: 'period_locked', message }
  }

  if (oldEntry) {
    await admin.from('tajir_journal_entry_lines').delete().eq('journal_entry_id', oldEntry.id)
    await admin.from('tajir_journal_entries').delete().eq('id', oldEntry.id)
  }

  const result = await postJournalEntry({
    ...params,
    voucherNumber: oldEntry?.voucher_number ?? undefined,
  })

  if (!result.ok && oldEntry) {
    // Put the previous entry back so the document is not left unrepresented.
    const { data: restored } = await admin
      .from('tajir_journal_entries')
      .insert({
        tenant_id:      tenantId,
        voucher_number: oldEntry.voucher_number,
        date:           oldEntry.date,
        description:    oldEntry.description,
        reference:      oldEntry.reference,
        source_type:    sourceType,
        source_id:      sourceId,
      })
      .select('id')
      .single()

    if (restored && oldLines && oldLines.length > 0) {
      await admin.from('tajir_journal_entry_lines').insert(
        oldLines.map((l) => ({ ...l, journal_entry_id: restored.id, tenant_id: tenantId })),
      )
    }

    console.error(
      `[repostJournalEntry] re-post failed for ${sourceType}/${sourceId}; ` +
        `previous entry ${oldEntry.voucher_number} was restored`,
    )
  }

  return result
}
