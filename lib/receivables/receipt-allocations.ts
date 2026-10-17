import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadInvoiceReceivables } from '@/lib/receivables/invoice-receivables'

// Optional "receipt against sale invoice" — shared by create-ar-receipt and
// edit-ar-receipt. See 0066_receipt_invoice_allocations.sql.

type Admin = ReturnType<typeof createAdminClient>

export const receiptAllocationSchema = z.object({
  invoiceKey: z.string().uuid('Invalid invoice'),
  amount:     z.coerce.number().positive('Applied amount must be positive'),
})

export type ReceiptAllocation = z.infer<typeof receiptAllocationSchema>

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Checks allocations before anything is written. Returns an error or null.
 *
 * Each invoice must belong to the customer, the total cannot exceed the
 * receipt, and no invoice can take more than is still open on it once
 * returns, credit notes and other receipts' allocations are taken off. Money
 * that FIFO had parked on an invoice does not count against it — placing a
 * receipt there simply moves that unallocated money to the next invoice.
 */
export async function checkAllocations(
  admin: Admin,
  tenantId: string,
  customerId: string,
  allocations: ReceiptAllocation[],
  receiptPkr: number,
  receiptId?: string,
): Promise<string | null> {
  if (allocations.length === 0) return null

  const keys = allocations.map((a) => a.invoiceKey)
  if (new Set(keys).size !== keys.length) return 'The same invoice is listed twice'

  const total = allocations.reduce((s, a) => s + a.amount, 0)
  if (r2(total) > r2(receiptPkr) + 0.01) return 'Applied to invoices is more than the receipt amount'

  const [customer] = await loadInvoiceReceivables(admin, tenantId, { customerId, excludeReceiptId: receiptId })
  const docs = new Map((customer?.docs ?? []).filter((d) => !d.isOpening).map((d) => [d.key, d]))
  for (const a of allocations) {
    const doc = docs.get(a.invoiceKey)
    if (!doc) return 'An invoice applied to does not belong to this customer'
    const open = doc.balance + doc.fifo
    if (r2(a.amount) > r2(open) + 0.01) {
      return `Invoice ${doc.serial ?? ''} has only ${r2(open).toLocaleString('en-PK')} open`.replace('  ', ' ')
    }
  }
  return null
}

/** Replaces a receipt's allocations. */
export async function saveAllocations(
  admin: Admin,
  tenantId: string,
  receiptId: string,
  customerId: string,
  allocations: ReceiptAllocation[],
): Promise<boolean> {
  const { error: delError } = await admin.from('ar_receipt_allocations').delete().eq('receipt_id', receiptId).eq('tenant_id', tenantId)
  if (delError) return false
  if (allocations.length === 0) return true
  const { error } = await admin.from('ar_receipt_allocations').insert(
    allocations.map((a) => ({ tenant_id: tenantId, receipt_id: receiptId, customer_id: customerId, invoice_key: a.invoiceKey, amount: r2(a.amount) })),
  )
  return !error
}
