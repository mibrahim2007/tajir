import { createAdminClient } from '@/lib/supabase/admin'
import { loadInvoiceReceivables } from '@/lib/receivables/invoice-receivables'
import { allocationSchema, validateAllocations, r2, type Allocation } from '@/lib/settlement/allocations'

// Optional "receipt against sale invoice" — shared by create-ar-receipt and
// edit-ar-receipt. See 0066_receipt_invoice_allocations.sql.

type Admin = ReturnType<typeof createAdminClient>

export const receiptAllocationSchema = allocationSchema
export type ReceiptAllocation = Allocation

/** Checks allocations before anything is written. Returns an error or null. */
export async function checkAllocations(
  admin: Admin,
  tenantId: string,
  customerId: string,
  allocations: ReceiptAllocation[],
  receiptPkr: number,
  receiptId?: string,
): Promise<string | null> {
  if (allocations.length === 0) return null
  const [customer] = await loadInvoiceReceivables(admin, tenantId, { customerId, excludeReceiptId: receiptId })
  return validateAllocations(customer, allocations, receiptPkr, 'receipt', 'customer')
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
