import { createAdminClient } from '@/lib/supabase/admin'
import { loadInvoicePayables } from '@/lib/payables/invoice-payables'
import { allocationSchema, validateAllocations, r2, type Allocation } from '@/lib/settlement/allocations'

// Optional "payment against purchase invoice" — shared by create-ap-payment
// and edit-ap-payment. See 0067_payment_invoice_allocations.sql.

type Admin = ReturnType<typeof createAdminClient>

export const paymentAllocationSchema = allocationSchema
export type PaymentAllocation = Allocation

/** Checks allocations before anything is written. Returns an error or null. */
export async function checkPaymentAllocations(
  admin: Admin,
  tenantId: string,
  supplierId: string,
  allocations: PaymentAllocation[],
  paymentPkr: number,
  paymentId?: string,
): Promise<string | null> {
  if (allocations.length === 0) return null
  const [supplier] = await loadInvoicePayables(admin, tenantId, { supplierId, excludePaymentId: paymentId })
  return validateAllocations(supplier, allocations, paymentPkr, 'payment', 'supplier')
}

/** Replaces a payment's allocations. */
export async function savePaymentAllocations(
  admin: Admin,
  tenantId: string,
  paymentId: string,
  supplierId: string,
  allocations: PaymentAllocation[],
): Promise<boolean> {
  const { error: delError } = await admin.from('ap_payment_allocations').delete().eq('payment_id', paymentId).eq('tenant_id', tenantId)
  if (delError) return false
  if (allocations.length === 0) return true
  const { error } = await admin.from('ap_payment_allocations').insert(
    allocations.map((a) => ({ tenant_id: tenantId, payment_id: paymentId, supplier_id: supplierId, invoice_key: a.invoiceKey, amount: r2(a.amount) })),
  )
  return !error
}
