import { createAdminClient } from '@/lib/supabase/admin'

// A "direct payment" is a customer-receipt line where the customer paid one of
// OUR suppliers on our behalf (ar_receipt_lines.transaction_type = 'direct').
// The receipt already lowers the customer's balance; this module is how the
// SUPPLIER side sees the same money. On the supplier's ledger it behaves
// exactly like an ap_payment: it reduces what we owe them and shows as a
// credit in the AP frame.
//
// Every supplier balance in the app is rebuilt from documents (there is no SQL
// balance function), so each of those places must subtract these. They all go
// through here so the query and its meaning live in one spot.
//
// Direct lines are PKR-only (create-ar-receipt enforces it), so `amount` is
// already the PKR figure.

export type DirectPayment = {
  lineId:        string
  receiptId:     string
  supplierId:    string
  supplierName:  string | null
  customerId:    string
  customerName:  string | null
  date:          string
  serialNumber:  string | null
  amount:        number
  hawalaRemarks: string | null
}

type Filter = { supplierId?: string; customerId?: string; receiptIds?: string[] }

type Admin = ReturnType<typeof createAdminClient>

export async function fetchDirectPayments(
  admin: Admin,
  tenantId: string,
  filter: Filter = {},
): Promise<DirectPayment[]> {
  let query = admin
    .from('ar_receipt_lines')
    .select(
      'id, receipt_id, supplier_id, amount, hawala_remarks, ' +
      'suppliers(name), ' +
      'ar_receipts!inner(date, serial_number, customer_id, tajir_customers(name))',
    )
    .eq('tenant_id', tenantId)
    .eq('transaction_type', 'direct')

  if (filter.supplierId) query = query.eq('supplier_id', filter.supplierId)
  if (filter.customerId) query = query.eq('ar_receipts.customer_id', filter.customerId)
  if (filter.receiptIds) {
    if (filter.receiptIds.length === 0) return []
    query = query.in('receipt_id', filter.receiptIds)
  }

  const { data, error } = await query
  // A silently-empty result would overstate every payable it feeds, so fail
  // loudly instead of returning [] on error.
  if (error) throw new Error(`fetchDirectPayments: ${error.message}`)

  type Row = {
    id: string
    receipt_id: string
    supplier_id: string | null
    amount: number
    hawala_remarks: string | null
    suppliers: { name: string } | null
    ar_receipts: { date: string; serial_number: string | null; customer_id: string; tajir_customers: { name: string } | null }
  }

  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.supplier_id)
    .map((r) => ({
      lineId:        r.id,
      receiptId:     r.receipt_id,
      supplierId:    r.supplier_id!,
      supplierName:  r.suppliers?.name ?? null,
      customerId:    r.ar_receipts.customer_id,
      customerName:  r.ar_receipts.tajir_customers?.name ?? null,
      date:          r.ar_receipts.date,
      serialNumber:  r.ar_receipts.serial_number,
      amount:        Number(r.amount),
      hawalaRemarks: r.hawala_remarks,
    }))
}

/** Sum of direct payments per supplier — subtract from each supplier's payable. */
export function sumBySupplier(payments: DirectPayment[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const p of payments) out.set(p.supplierId, (out.get(p.supplierId) ?? 0) + p.amount)
  return out
}

/** Ledger narration on the SUPPLIER's side. */
export function supplierSideDescription(p: DirectPayment): string {
  return [
    `${p.serialNumber ?? 'Receipt'} · Paid by customer ${p.customerName ?? '—'} (direct)`,
    p.hawalaRemarks ? `Hawala: ${p.hawalaRemarks}` : null,
  ].filter(Boolean).join(' — ')
}

/** Short suffix for the CUSTOMER's receipt row naming who was paid. */
export function customerSideSuffix(payments: DirectPayment[]): string {
  if (payments.length === 0) return ''
  const parts = payments.map((p) =>
    [`direct to ${p.supplierName ?? 'supplier'}`, p.hawalaRemarks ? `Hawala: ${p.hawalaRemarks}` : null]
      .filter(Boolean).join(', '),
  )
  return ` (${parts.join('; ')})`
}
