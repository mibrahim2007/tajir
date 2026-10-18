// What we still owe each supplier, invoice by invoice.
//
// Mirror of lib/receivables/invoice-receivables.ts for the supplier side, used
// by the payment form, the Pending Payables (invoice-wise) report and Payables
// Aging. Settlement rules: lib/settlement/invoice-settlement.ts.
//
//   invoices      purchase_orders grouped by invoice_id ?? id, each line net
//                 of the advance paid on the invoice itself
//   specific      payment allocations (ap_payment_allocations); purchase
//                 returns and debit notes that name a purchase line
//   pool          unallocated payment money, customer receipts that paid this
//                 supplier for us (direct lines), unlinked returns and debit
//                 notes, less supplier refunds
//
// The totals equal the supplier ledger (opening + purchases net of advance −
// payments − direct payments − returns − debit notes + refunds) whenever that
// balance is owed to the supplier.

import { createAdminClient } from '@/lib/supabase/admin'
import { fetchDirectPayments } from '@/lib/ledger/direct-payments'
import { settleParty, creditBook, OPENING_KEY, type DocInput, type SettledParty } from '@/lib/settlement/invoice-settlement'

export { openDocs, OPENING_KEY } from '@/lib/settlement/invoice-settlement'
export type { SettledDoc as PayableDoc } from '@/lib/settlement/invoice-settlement'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Loads and settles every supplier's invoices.
 *
 * `excludePaymentId` leaves one payment out entirely — its money and its
 * allocations — so the edit form shows what is open before that payment.
 */
export async function loadInvoicePayables(
  admin: Admin,
  tenantId: string,
  opts: { supplierId?: string; excludePaymentId?: string } = {},
): Promise<SettledParty[]> {
  const { supplierId, excludePaymentId } = opts
  // An empty match() is a no-op, so one query shape serves both scopes.
  const bySupplier = supplierId ? { supplier_id: supplierId } : {}

  const [
    { data: rawSuppliers },
    { data: rawPurchases },
    { data: rawPayments },
    { data: rawAllocations },
    { data: rawReturns },
    { data: rawDebitNotes },
    { data: rawRefunds },
    directPayments,
  ] = await Promise.all([
    admin.from('suppliers').select('id, name, opening_balance_pkr_equivalent, created_at').eq('tenant_id', tenantId).match(supplierId ? { id: supplierId } : {}),
    admin.from('purchase_orders').select('id, invoice_id, serial_number, supplier_invoice_no, supplier_id, date, payment_due_date, pkr_equivalent, advance_paid').eq('tenant_id', tenantId).match(bySupplier),
    admin.from('ap_payments').select('id, supplier_id, pkr_equivalent').eq('tenant_id', tenantId).match(bySupplier),
    admin.from('ap_payment_allocations').select('payment_id, supplier_id, invoice_key, amount').eq('tenant_id', tenantId).match(bySupplier),
    admin.from('purchase_returns').select('supplier_id, purchase_order_id, pkr_equivalent').eq('tenant_id', tenantId).match(bySupplier),
    admin.from('debit_notes').select('supplier_id, purchase_order_id, pkr_equivalent').eq('tenant_id', tenantId).match(bySupplier),
    admin.from('supplier_refunds').select('supplier_id, pkr_equivalent').eq('tenant_id', tenantId).match(bySupplier),
    fetchDirectPayments(admin, tenantId, { supplierId }),
  ])

  // purchase line id → invoice key, for returns and debit notes that name a line.
  const lineToKey = new Map<string, string>()
  const docsBySupplier = new Map<string, Map<string, DocInput>>()
  for (const l of rawPurchases ?? []) {
    const key = l.invoice_id ?? l.id
    lineToKey.set(l.id, key)
    const net = Number(l.pkr_equivalent ?? 0) - Number(l.advance_paid ?? 0)
    const docs = docsBySupplier.get(l.supplier_id) ?? new Map<string, DocInput>()
    docsBySupplier.set(l.supplier_id, docs)
    const existing = docs.get(key)
    if (existing) {
      existing.amount += net
      existing.dueDate ??= l.payment_due_date
      existing.ref ??= l.supplier_invoice_no
      continue
    }
    docs.set(key, {
      key, invoiceId: l.invoice_id, isOpening: false, date: l.date, dueDate: l.payment_due_date,
      serial: l.serial_number, ref: l.supplier_invoice_no, amount: net,
    })
  }

  const book = creditBook()
  const allocatedByPayment = new Map<string, number>()
  for (const a of rawAllocations ?? []) {
    if (a.payment_id === excludePaymentId) continue
    allocatedByPayment.set(a.payment_id, (allocatedByPayment.get(a.payment_id) ?? 0) + Number(a.amount))
    book.addSpecific(a.supplier_id, { key: a.invoice_key, amount: Number(a.amount), kind: 'applied' })
  }
  for (const p of rawPayments ?? []) {
    if (p.id === excludePaymentId) continue
    // Allocation is capped at the payment in the action; max() guards old data.
    book.addPool(p.supplier_id, Math.max(Number(p.pkr_equivalent) - (allocatedByPayment.get(p.id) ?? 0), 0))
  }
  // A customer who paid the supplier for us settles the oldest bills, same as
  // an unallocated payment.
  for (const d of directPayments) book.addPool(d.supplierId, d.amount)
  for (const r of [...(rawReturns ?? []), ...(rawDebitNotes ?? [])]) {
    const key = r.purchase_order_id ? lineToKey.get(r.purchase_order_id) : undefined
    if (key) book.addSpecific(r.supplier_id, { key, amount: Number(r.pkr_equivalent), kind: 'returned' })
    else book.addPool(r.supplier_id, Number(r.pkr_equivalent))
  }
  // A refund from the supplier hands back a credit we were holding.
  for (const r of rawRefunds ?? []) book.addPool(r.supplier_id, -Number(r.pkr_equivalent))

  const result: SettledParty[] = []
  for (const s of rawSuppliers ?? []) {
    const docs: DocInput[] = []
    for (const d of docsBySupplier.get(s.id)?.values() ?? []) {
      // An invoice paid more in advance than it cost leaves us in credit:
      // that surplus settles other bills, like any unallocated payment.
      if (d.amount < 0) book.addPool(s.id, -d.amount)
      else if (d.amount > 0) docs.push(d)
    }
    const opening = Number(s.opening_balance_pkr_equivalent ?? 0)
    if (opening > 0) {
      docs.push({
        key: OPENING_KEY, invoiceId: null, isOpening: true, date: s.created_at.split('T')[0],
        dueDate: null, serial: null, ref: null, amount: opening,
      })
    }
    const settled = settleParty(docs, book.specificFor(s.id), book.poolFor(s.id))
    result.push({ partyId: s.id, partyName: s.name, ...settled })
  }
  return result
}
