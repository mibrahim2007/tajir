import type { SupabaseClient } from '@supabase/supabase-js'

export type DocType = 'purchase_order' | 'sale_invoice' | 'purchase_return' | 'sale_return'

/**
 * Allocates the next tenant- and document-type-scoped serial number.
 *
 * Format: `<PREFIX>-<YYYY>-<NNNN>` (e.g. `PO-2026-0001`), where the counter
 * resets each calendar year — the year is taken from the document `date`.
 *
 * Backed by the `next_document_serial` Postgres function, whose atomic
 * `INSERT … ON CONFLICT DO UPDATE` guarantees no duplicate numbers even under
 * concurrent document creation. For multi-line invoices, call this ONCE and
 * apply the returned serial to every line row sharing the invoice.
 *
 * Returns `null` if allocation fails (the caller should treat that as a soft
 * failure — the document still saves, just without a serial).
 */
export async function nextDocumentSerial(
  admin: SupabaseClient,
  tenantId: string,
  docType: DocType,
  date: string,
): Promise<string | null> {
  const { data, error } = await admin.rpc('next_document_serial', {
    p_tenant_id: tenantId,
    p_doc_type:  docType,
    p_date:      date,
  })
  if (error || typeof data !== 'string') return null
  return data
}
