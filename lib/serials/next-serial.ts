import type { SupabaseClient } from '@supabase/supabase-js'

export type DocType =
  | 'purchase_order'
  | 'sale_invoice'
  | 'purchase_return'
  | 'sale_return'
  | 'ar_receipt'
  | 'ap_payment'
  | 'customer_refund'
  | 'supplier_refund'
  | 'employee_loan'
  | 'loan_repayment'

/**
 * Prefix per document type — MUST stay in sync with the `CASE` in the
 * `next_document_serial` Postgres function (migrations 0018 / 0019 / 0020 / 0026).
 */
const DOC_TYPE_PREFIX: Record<DocType, string> = {
  purchase_order:  'PO',
  sale_invoice:    'SI',
  purchase_return: 'PR',
  sale_return:     'SR',
  ar_receipt:      'RCP',
  ap_payment:      'PAY',
  customer_refund: 'REF',
  supplier_refund: 'RCV',
  employee_loan:   'LN',
  loan_repayment:  'LR',
}

function formatSerial(docType: DocType, year: number, n: number): string {
  return `${DOC_TYPE_PREFIX[docType]}-${year}-${String(n).padStart(4, '0')}`
}

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

/**
 * Previews the serial the next `nextDocumentSerial()` call will most likely
 * produce, WITHOUT consuming a number. For read-only display (e.g. a disabled
 * field on a form) so the user can see the voucher number before saving.
 *
 * Best-effort only: the real number is allocated atomically on save, so a
 * concurrent voucher created in between would make the actual serial higher.
 * The year is taken from `date`; if that year has no counter yet, the preview
 * is `-0001`. Returns `null` on error.
 */
export async function peekNextDocumentSerial(
  admin: SupabaseClient,
  tenantId: string,
  docType: DocType,
  date: string,
): Promise<string | null> {
  const year = new Date(date).getUTCFullYear()
  const { data, error } = await admin
    .from('document_serials')
    .select('last_number')
    .eq('tenant_id', tenantId)
    .eq('doc_type', docType)
    .eq('year', year)
    .maybeSingle()
  if (error) return null
  return formatSerial(docType, year, (data?.last_number ?? 0) + 1)
}
