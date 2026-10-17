// What each customer still owes, invoice by invoice — one implementation.
//
// Used by the receipt form (which invoices are open, and how much), the
// Pending Receivables (invoice-wise) report, and Receivables Aging, so all
// three always agree about the same money.
//
// Settlement order for one customer:
//
//   1. Specific credits settle the invoice they name:
//        • a sale return or credit note linked to one of the invoice's lines
//        • the part of a receipt the user applied to that invoice
//          (ar_receipt_allocations)
//      Anything beyond the invoice's amount spills into the pool.
//   2. The pool — every credit not tied to an invoice (unallocated receipt
//      money, unlinked returns and credit notes, less refunds) — settles what
//      is left oldest-first, the opening balance first of all. That is the
//      FIFO assumption Tajir has always made, now applied only to the money
//      the user did not place.
//
// The totals equal the customer ledger (opening + sales − receipts − returns
// − credit notes + refunds) whenever that balance is a debit.

import { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

/** Key used for the opening balance pseudo-document. */
export const OPENING_KEY = 'opening'

export type ReceivableDoc = {
  /** invoice_id ?? id of the line (see sale-detail), or OPENING_KEY. */
  key: string
  /** Set for real invoices; null for legacy single-line sales and the opening balance. */
  invoiceId: string | null
  isOpening: boolean
  date: string
  dueDate: string | null
  serial: string | null
  poNo: string | null
  amount: number
  /** Linked sale returns and credit notes. */
  returned: number
  /** Receipt money the user applied to this invoice. */
  received: number
  /** Share of the unallocated pool that settled it, oldest-first. */
  fifo: number
  balance: number
}

export type CustomerReceivables = {
  customerId: string
  customerName: string
  docs: ReceivableDoc[]
  /** Pool left over after every document was settled — an advance / credit balance. */
  unappliedCredit: number
}

type DocInput = Omit<ReceivableDoc, 'returned' | 'received' | 'fifo' | 'balance'>
type SpecificCredit = { key: string; amount: number; kind: 'returned' | 'received' }

const EPS = 0.005

/** Pure settlement for one customer. Exported for the check script. */
export function settleCustomer(docs: DocInput[], specific: SpecificCredit[], pool: number): { docs: ReceivableDoc[]; unappliedCredit: number } {
  const out: ReceivableDoc[] = docs
    .map((d) => ({ ...d, returned: 0, received: 0, fifo: 0, balance: d.amount }))
    .sort((a, b) => (a.isOpening === b.isOpening ? 0 : a.isOpening ? -1 : 1) || a.date.localeCompare(b.date) || (a.serial ?? '').localeCompare(b.serial ?? ''))
  const byKey = new Map(out.map((d) => [d.key, d]))

  let remainingPool = pool
  for (const c of specific) {
    const doc = byKey.get(c.key)
    // Opening balance has no invoice to name; an unknown key means the invoice
    // was deleted or now belongs to someone else. Either way: unallocated.
    if (!doc || doc.isOpening) { remainingPool += c.amount; continue }
    const applied = Math.min(c.amount, Math.max(doc.balance, 0))
    doc[c.kind] += applied
    doc.balance -= applied
    remainingPool += c.amount - applied
  }

  for (const doc of out) {
    if (remainingPool <= EPS) break
    if (doc.balance <= EPS) continue
    const applied = Math.min(remainingPool, doc.balance)
    doc.fifo += applied
    doc.balance -= applied
    remainingPool -= applied
  }

  return { docs: out, unappliedCredit: Math.max(remainingPool, 0) }
}

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
): Promise<CustomerReceivables[]> {
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
      existing.poNo ??= l.po_no
      continue
    }
    docs.set(key, {
      key, invoiceId: l.invoice_id, isOpening: false, date: l.date, dueDate: l.payment_due_date,
      serial: l.serial_number, poNo: l.po_no, amount: Number(l.pkr_equivalent ?? 0),
    })
  }

  const specificBy = new Map<string, SpecificCredit[]>()
  const poolBy = new Map<string, number>()
  const addPool = (cid: string, n: number) => poolBy.set(cid, (poolBy.get(cid) ?? 0) + n)
  const addSpecific = (cid: string, c: SpecificCredit) => {
    const list = specificBy.get(cid) ?? []
    list.push(c)
    specificBy.set(cid, list)
  }

  const allocatedByReceipt = new Map<string, number>()
  for (const a of rawAllocations ?? []) {
    if (a.receipt_id === excludeReceiptId) continue
    allocatedByReceipt.set(a.receipt_id, (allocatedByReceipt.get(a.receipt_id) ?? 0) + Number(a.amount))
    addSpecific(a.customer_id, { key: a.invoice_key, amount: Number(a.amount), kind: 'received' })
  }
  for (const r of rawReceipts ?? []) {
    if (r.id === excludeReceiptId) continue
    // Allocation is capped at the receipt in the action; max() guards old data.
    addPool(r.customer_id, Math.max(Number(r.pkr_equivalent) - (allocatedByReceipt.get(r.id) ?? 0), 0))
  }
  for (const r of [...(rawReturns ?? []), ...(rawCreditNotes ?? [])]) {
    const key = r.sale_order_id ? lineToKey.get(r.sale_order_id) : undefined
    if (key) addSpecific(r.customer_id, { key, amount: Number(r.pkr_equivalent), kind: 'returned' })
    else addPool(r.customer_id, Number(r.pkr_equivalent))
  }
  // A refund hands back a credit the customer was holding, so it un-does one.
  for (const r of rawRefunds ?? []) addPool(r.customer_id, -Number(r.pkr_equivalent))

  const result: CustomerReceivables[] = []
  for (const c of rawCustomers ?? []) {
    const docs = [...(docsByCustomer.get(c.id)?.values() ?? [])]
    const opening = Number(c.opening_balance_pkr_equivalent ?? 0)
    if (opening > 0) {
      docs.push({
        key: OPENING_KEY, invoiceId: null, isOpening: true, date: c.created_at.split('T')[0],
        dueDate: null, serial: null, poNo: null, amount: opening,
      })
    }
    const settled = settleCustomer(docs, specificBy.get(c.id) ?? [], poolBy.get(c.id) ?? 0)
    result.push({ customerId: c.id, customerName: c.name, ...settled })
  }
  return result
}

/** Only the documents still owed on. */
export function openDocs(c: CustomerReceivables): ReceivableDoc[] {
  return c.docs.filter((d) => d.balance > EPS)
}
