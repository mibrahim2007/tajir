// What each customer still owes, invoice by invoice.
//
// Used by the receipt form (which invoices are open, and how much), the
// Pending Receivables (invoice-wise) report, and Receivables Aging, so all
// three always agree about the same money. The settlement rules live in
// lib/settlement/invoice-settlement.ts; this file only gathers the
// customer-side documents:
//
//   invoices      sales_orders grouped by invoice_id ?? id
//   specific      receipt allocations (ar_receipt_allocations); sale returns
//                 and credit notes that name a sale line
//   pool          unallocated receipt money, unlinked returns and credit
//                 notes, less customer refunds
//
// The totals equal the customer ledger (opening + sales − receipts − returns
// − credit notes + refunds) whenever that balance is a debit.

import { createAdminClient } from '@/lib/supabase/admin'
import { settleParty, creditBook, OPENING_KEY, type DocInput, type SettledParty } from '@/lib/settlement/invoice-settlement'

export { openDocs, OPENING_KEY } from '@/lib/settlement/invoice-settlement'
export type { SettledDoc as ReceivableDoc } from '@/lib/settlement/invoice-settlement'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Loads and settles every customer's invoices.
 *
 * `excludeReceiptId` leaves one receipt out entirely — its money and its
 * allocations — so the edit form shows what is open before that receipt.
 */
export async function loadInvoiceReceivables(
  admin: Admin,
  tenantId: string,
  opts: { customerId?: string; excludeReceiptId?: string } = {},
): Promise<SettledParty[]> {
  const { customerId, excludeReceiptId } = opts
  // An empty match() is a no-op, so one query shape serves both scopes.
  const byCustomer = customerId ? { customer_id: customerId } : {}

  const [
    { data: rawCustomers },
    { data: rawSales },
    { data: rawReceipts },
    { data: rawAllocations },
    { data: rawReturns },
    { data: rawCreditNotes },
    { data: rawRefunds },
  ] = await Promise.all([
    admin.from('tajir_customers').select('id, name, opening_balance_pkr_equivalent, created_at').eq('tenant_id', tenantId).match(customerId ? { id: customerId } : {}),
    admin.from('sales_orders').select('id, invoice_id, serial_number, po_no, customer_id, date, payment_due_date, pkr_equivalent').eq('tenant_id', tenantId).match(byCustomer),
    admin.from('ar_receipts').select('id, customer_id, pkr_equivalent').eq('tenant_id', tenantId).match(byCustomer),
    admin.from('ar_receipt_allocations').select('receipt_id, customer_id, invoice_key, amount').eq('tenant_id', tenantId).match(byCustomer),
    admin.from('sale_returns').select('customer_id, sale_order_id, pkr_equivalent').eq('tenant_id', tenantId).match(byCustomer),
    admin.from('credit_notes').select('customer_id, sale_order_id, pkr_equivalent').eq('tenant_id', tenantId).match(byCustomer),
    admin.from('customer_refunds').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId).match(byCustomer),
  ])

  // sale line id → invoice key, for returns and credit notes that name a line.
  const lineToKey = new Map<string, string>()
  const docsByCustomer = new Map<string, Map<string, DocInput>>()
  for (const l of rawSales ?? []) {
    const key = l.invoice_id ?? l.id
    lineToKey.set(l.id, key)
    const docs = docsByCustomer.get(l.customer_id) ?? new Map<string, DocInput>()
    docsByCustomer.set(l.customer_id, docs)
    const existing = docs.get(key)
    if (existing) {
      existing.amount += Number(l.pkr_equivalent ?? 0)
      existing.dueDate ??= l.payment_due_date
      existing.ref ??= l.po_no
      continue
    }
    docs.set(key, {
      key, invoiceId: l.invoice_id, isOpening: false, date: l.date, dueDate: l.payment_due_date,
      serial: l.serial_number, ref: l.po_no, amount: Number(l.pkr_equivalent ?? 0),
    })
  }

  const book = creditBook()
  const allocatedByReceipt = new Map<string, number>()
  for (const a of rawAllocations ?? []) {
    if (a.receipt_id === excludeReceiptId) continue
    allocatedByReceipt.set(a.receipt_id, (allocatedByReceipt.get(a.receipt_id) ?? 0) + Number(a.amount))
    book.addSpecific(a.customer_id, { key: a.invoice_key, amount: Number(a.amount), kind: 'applied' })
  }
  for (const r of rawReceipts ?? []) {
    if (r.id === excludeReceiptId) continue
    // Allocation is capped at the receipt in the action; max() guards old data.
    book.addPool(r.customer_id, Math.max(Number(r.pkr_equivalent) - (allocatedByReceipt.get(r.id) ?? 0), 0))
  }
  for (const r of [...(rawReturns ?? []), ...(rawCreditNotes ?? [])]) {
    const key = r.sale_order_id ? lineToKey.get(r.sale_order_id) : undefined
    if (key) book.addSpecific(r.customer_id, { key, amount: Number(r.pkr_equivalent), kind: 'returned' })
    else book.addPool(r.customer_id, Number(r.pkr_equivalent))
  }
  // A refund hands back a credit the customer was holding, so it un-does one.
  for (const r of rawRefunds ?? []) book.addPool(r.customer_id, -Number(r.pkr_equivalent))

  const result: SettledParty[] = []
  for (const c of rawCustomers ?? []) {
    const docs = [...(docsByCustomer.get(c.id)?.values() ?? [])]
    const opening = Number(c.opening_balance_pkr_equivalent ?? 0)
    if (opening > 0) {
      docs.push({
        key: OPENING_KEY, invoiceId: null, isOpening: true, date: c.created_at.split('T')[0],
        dueDate: null, serial: null, ref: null, amount: opening,
      })
    }
    const settled = settleParty(docs, book.specificFor(c.id), book.poolFor(c.id))
    result.push({ partyId: c.id, partyName: c.name, ...settled })
  }
  return result
}
