import { createAdminClient } from '@/lib/supabase/admin'

// A single consolidated statement for a mapped customer↔supplier pair.
//
// Sign convention (the "net receivable" frame):
//   balance > 0  →  the party owes us on net (their AR exceeds our AP to them)
//   balance < 0  →  we owe the party on net
//
// Customer-side rows keep their AR polarity (a sale is a debit that grows what
// they owe us). Supplier-side rows are FLIPPED: in the supplier's own AP ledger
// a purchase is a debit (we owe them more), but in the net frame that REDUCES
// what they owe us, so it becomes a net credit. Flipping every supplier row's
// debit/credit yields exactly netBalance = customerBalance − supplierBalance.

export type ConsolidatedRow = {
  id: string
  side: 'customer' | 'supplier'
  kind: string
  date: string
  description: string
  debit: number
  credit: number
  balance: number
}

export type ConsolidatedLedger = {
  rows: ConsolidatedRow[]
  customerBalance: number // AR frame: + = they owe us
  supplierBalance: number // AP frame: + = we owe them
  netBalance: number // customerBalance − supplierBalance
}

// Intermediate entry in each party's own polarity before the net flip.
type NativeEntry = {
  id: string
  side: 'customer' | 'supplier'
  kind: string
  date: string
  description: string
  debit: number
  credit: number
}

export async function buildConsolidatedLedger(
  tenantId: string,
  customerId: string,
  supplierId: string,
  preloadedLots?: Map<string, string>,
): Promise<ConsolidatedLedger> {
  const admin = createAdminClient()

  const [
    { data: customerRow },
    { data: supplierRow },
    // customer sources
    { data: rawSales },
    { data: rawReceipts },
    { data: rawSaleReturns },
    { data: rawCreditNotes },
    { data: rawCustomerRefunds },
    // supplier sources
    { data: rawPurchases },
    { data: rawPayments },
    { data: rawPurchaseReturns },
    { data: rawDebitNotes },
    { data: rawSupplierRefunds },
    { data: rawLots },
  ] = await Promise.all([
    admin.from('tajir_customers').select('opening_balance_pkr_equivalent, created_at').eq('id', customerId).eq('tenant_id', tenantId).maybeSingle(),
    admin.from('suppliers').select('opening_balance_pkr_equivalent, created_at').eq('id', supplierId).eq('tenant_id', tenantId).maybeSingle(),
    admin.from('sales_orders').select('id, date, stock_item_id, quantity, rate, currency_code, pkr_equivalent').eq('customer_id', customerId).eq('tenant_id', tenantId),
    admin.from('ar_receipts').select('id, date, pkr_equivalent, payment_method_note, serial_number').eq('customer_id', customerId).eq('tenant_id', tenantId),
    admin.from('sale_returns').select('id, date, stock_item_id, quantity, pkr_equivalent, reason').eq('customer_id', customerId).eq('tenant_id', tenantId),
    admin.from('credit_notes').select('id, date, pkr_equivalent, reason, reference').eq('customer_id', customerId).eq('tenant_id', tenantId),
    admin.from('customer_refunds').select('id, date, pkr_equivalent, payment_method, notes, serial_number').eq('customer_id', customerId).eq('tenant_id', tenantId),
    admin.from('purchase_orders').select('id, date, stock_item_id, quantity, rate, currency_code, pkr_equivalent, advance_paid').eq('supplier_id', supplierId).eq('tenant_id', tenantId),
    admin.from('ap_payments').select('id, date, pkr_equivalent, payment_method_note, serial_number').eq('supplier_id', supplierId).eq('tenant_id', tenantId),
    admin.from('purchase_returns').select('id, date, stock_item_id, quantity, pkr_equivalent, reason').eq('supplier_id', supplierId).eq('tenant_id', tenantId),
    admin.from('debit_notes').select('id, date, pkr_equivalent, reason, reference').eq('supplier_id', supplierId).eq('tenant_id', tenantId),
    admin.from('supplier_refunds').select('id, date, pkr_equivalent, payment_method, notes, serial_number').eq('supplier_id', supplierId).eq('tenant_id', tenantId),
    preloadedLots ? Promise.resolve({ data: null }) : admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
  ])

  const lotMap = preloadedLots ?? new Map((rawLots ?? []).map((l) => [l.id, l.name]))
  const itemName = (id: string | null) => (id ? lotMap.get(id) ?? 'Unknown item' : 'Unknown item')

  const entries: NativeEntry[] = []

  // ── Customer side (AR polarity: debit = they owe us more) ──
  const custOb = customerRow?.opening_balance_pkr_equivalent ?? 0
  if (custOb !== 0) {
    entries.push({ id: `cust-ob`, side: 'customer', kind: 'opening', date: (customerRow!.created_at as string).split('T')[0], description: 'Opening Balance (Customer)', debit: custOb, credit: 0 })
  }
  for (const e of rawSales ?? []) {
    entries.push({ id: e.id, side: 'customer', kind: 'sale', date: e.date, description: `Sale — ${itemName(e.stock_item_id)} (${e.quantity} @ ${e.currency_code} ${e.rate})`, debit: e.pkr_equivalent, credit: 0 })
  }
  for (const e of rawReceipts ?? []) {
    entries.push({ id: e.id, side: 'customer', kind: 'receipt', date: e.date, description: `${e.serial_number ? `${e.serial_number} · ` : ''}Receipt${e.payment_method_note ? ` — ${e.payment_method_note}` : ''}`, debit: 0, credit: e.pkr_equivalent })
  }
  for (const e of rawSaleReturns ?? []) {
    entries.push({ id: e.id, side: 'customer', kind: 'sale_return', date: e.date, description: `Sale Return — ${itemName(e.stock_item_id)} (${e.quantity}${e.reason ? ` — ${e.reason}` : ''})`, debit: 0, credit: e.pkr_equivalent })
  }
  for (const e of rawCreditNotes ?? []) {
    entries.push({ id: e.id, side: 'customer', kind: 'credit_note', date: e.date, description: `Credit Note${e.reason ? ` — ${e.reason}` : ''}${e.reference ? ` (Ref: ${e.reference})` : ''}`, debit: 0, credit: e.pkr_equivalent })
  }
  for (const e of rawCustomerRefunds ?? []) {
    entries.push({ id: e.id, side: 'customer', kind: 'customer_refund', date: e.date, description: `${e.serial_number ? `${e.serial_number} · ` : ''}Customer Refund — ${e.payment_method === 'bank_transfer' ? 'Bank Transfer' : 'Cash'}${e.notes ? ` (${e.notes})` : ''}`, debit: e.pkr_equivalent, credit: 0 })
  }

  // ── Supplier side (AP polarity: debit = we owe them more) ──
  const suppOb = supplierRow?.opening_balance_pkr_equivalent ?? 0
  if (suppOb !== 0) {
    entries.push({ id: `supp-ob`, side: 'supplier', kind: 'opening', date: (supplierRow!.created_at as string).split('T')[0], description: 'Opening Balance (Supplier)', debit: suppOb, credit: 0 })
  }
  for (const e of rawPurchases ?? []) {
    const net = e.pkr_equivalent - e.advance_paid
    entries.push({ id: e.id, side: 'supplier', kind: 'purchase', date: e.date, description: `Purchase — ${itemName(e.stock_item_id)} (${e.quantity} @ ${e.currency_code} ${e.rate})`, debit: net, credit: 0 })
  }
  for (const e of rawPayments ?? []) {
    entries.push({ id: e.id, side: 'supplier', kind: 'payment', date: e.date, description: `${e.serial_number ? `${e.serial_number} · ` : ''}Payment${e.payment_method_note ? ` — ${e.payment_method_note}` : ''}`, debit: 0, credit: e.pkr_equivalent })
  }
  for (const e of rawPurchaseReturns ?? []) {
    entries.push({ id: e.id, side: 'supplier', kind: 'purchase_return', date: e.date, description: `Purchase Return — ${itemName(e.stock_item_id)} (${e.quantity}${e.reason ? ` — ${e.reason}` : ''})`, debit: 0, credit: e.pkr_equivalent })
  }
  for (const e of rawDebitNotes ?? []) {
    entries.push({ id: e.id, side: 'supplier', kind: 'debit_note', date: e.date, description: `Debit Note${e.reason ? ` — ${e.reason}` : ''}${e.reference ? ` (Ref: ${e.reference})` : ''}`, debit: 0, credit: e.pkr_equivalent })
  }
  for (const e of rawSupplierRefunds ?? []) {
    entries.push({ id: e.id, side: 'supplier', kind: 'supplier_refund', date: e.date, description: `${e.serial_number ? `${e.serial_number} · ` : ''}Payment Received from Supplier — ${e.payment_method === 'bank_transfer' ? 'Bank Transfer' : e.payment_method === 'cash' ? 'Cash' : 'Mixed'}${e.notes ? ` (${e.notes})` : ''}`, debit: e.pkr_equivalent, credit: 0 })
  }

  // Component balances in each party's own frame.
  let customerBalance = 0
  let supplierBalance = 0
  for (const e of entries) {
    if (e.side === 'customer') customerBalance += e.debit - e.credit
    else supplierBalance += e.debit - e.credit
  }

  // Merge chronologically, flip supplier polarity into the net frame, fold.
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.side.localeCompare(b.side))

  const rows: ConsolidatedRow[] = []
  let running = 0
  for (const e of entries) {
    const debit = e.side === 'customer' ? e.debit : e.credit
    const credit = e.side === 'customer' ? e.credit : e.debit
    running += debit - credit
    rows.push({ id: `${e.side}-${e.id}`, side: e.side, kind: e.kind, date: e.date, description: e.description, debit, credit, balance: running })
  }

  return { rows, customerBalance, supplierBalance, netBalance: customerBalance - supplierBalance }
}
