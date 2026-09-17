import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { round2 } from './params'

// One ledger builder for customers and suppliers. The Excel exports under
// app/api/export/{customer,supplier}-ledger carry the same event rules; keep
// them in step if either changes.

type Admin = SupabaseClient<Database>

export type LedgerLineType =
  | 'opening_balance'
  | 'sale' | 'receipt' | 'sale_return' | 'credit_note'
  | 'purchase' | 'payment' | 'purchase_return' | 'debit_note'

export type LedgerLine = {
  date: string
  type: LedgerLineType
  id: string | null
  description: string
  debit: number
  credit: number
  balance: number
}

type LedgerEvent = {
  date: string
  type: Exclude<LedgerLineType, 'opening_balance'>
  id: string
  amount: number
  sign: 1 | -1
  description: string
}

export type PartyLedger = {
  party: { id: string; name: string }
  period: { from: string | null; to: string | null }
  brought_forward: number | null
  closing_balance: number
  currency: 'PKR'
  lines: LedgerLine[]
}

type Party = { id: string; name: string; opening_balance_pkr_equivalent: number; created_at: string }

// Running balance is always computed from the start so a date-filtered window
// still opens with the correct carried-forward balance.
function assemble(party: Party, events: LedgerEvent[], from: string | null, to: string | null): PartyLedger {
  events.sort((a, b) => a.date.localeCompare(b.date))

  const openingDate = party.created_at.split('T')[0]
  let balance = party.opening_balance_pkr_equivalent
  let broughtForward = balance
  const lines: LedgerLine[] = []

  if ((!from || openingDate >= from) && party.opening_balance_pkr_equivalent !== 0) {
    lines.push({
      date: openingDate, type: 'opening_balance', id: null, description: 'Opening Balance',
      debit: round2(balance), credit: 0, balance: round2(balance),
    })
  }

  for (const ev of events) {
    balance += ev.sign * ev.amount
    if (from && ev.date < from) { broughtForward = balance; continue }
    if (to && ev.date > to) break
    lines.push({
      date: ev.date, type: ev.type, id: ev.id, description: ev.description,
      debit: ev.sign > 0 ? round2(ev.amount) : 0,
      credit: ev.sign < 0 ? round2(ev.amount) : 0,
      balance: round2(balance),
    })
  }

  return {
    party: { id: party.id, name: party.name },
    period: { from, to },
    brought_forward: from ? round2(broughtForward) : null,
    closing_balance: round2(lines.length ? lines[lines.length - 1].balance : broughtForward),
    currency: 'PKR',
    lines,
  }
}

const unknownItem = '?'

export async function buildCustomerLedger(
  admin: Admin, tenantId: string, customerId: string, from: string | null, to: string | null,
): Promise<PartyLedger | null> {
  const [{ data: customer }, { data: sales }, { data: receipts }, { data: returns }, { data: creditNotes }, { data: lots }] = await Promise.all([
    admin.from('tajir_customers').select('id, name, opening_balance_pkr_equivalent, created_at').eq('id', customerId).eq('tenant_id', tenantId).single(),
    admin.from('sales_orders').select('id, date, stock_item_id, quantity, rate, currency_code, pkr_equivalent').eq('customer_id', customerId).eq('tenant_id', tenantId),
    admin.from('ar_receipts').select('id, date, pkr_equivalent, payment_method_note').eq('customer_id', customerId).eq('tenant_id', tenantId),
    admin.from('sale_returns').select('id, date, stock_item_id, quantity, pkr_equivalent, reason').eq('customer_id', customerId).eq('tenant_id', tenantId),
    admin.from('credit_notes').select('id, date, pkr_equivalent, reason, reference').eq('customer_id', customerId).eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
  ])
  if (!customer) return null

  const lotMap = new Map((lots ?? []).map((l) => [l.id, l.name]))
  const events: LedgerEvent[] = [
    ...(sales ?? []).map((e): LedgerEvent => ({
      date: e.date, type: 'sale', id: e.id, amount: e.pkr_equivalent, sign: 1,
      description: `Sale — ${lotMap.get(e.stock_item_id) ?? unknownItem} (${e.quantity} @ ${e.currency_code} ${e.rate})`,
    })),
    ...(receipts ?? []).map((e): LedgerEvent => ({
      date: e.date, type: 'receipt', id: e.id, amount: e.pkr_equivalent, sign: -1,
      description: `Receipt${e.payment_method_note ? ` — ${e.payment_method_note}` : ''}`,
    })),
    ...(returns ?? []).map((e): LedgerEvent => ({
      date: e.date, type: 'sale_return', id: e.id, amount: e.pkr_equivalent, sign: -1,
      description: `Sale Return — ${lotMap.get(e.stock_item_id) ?? unknownItem} (${e.quantity} units${e.reason ? ` — ${e.reason}` : ''})`,
    })),
    ...(creditNotes ?? []).map((e): LedgerEvent => ({
      date: e.date, type: 'credit_note', id: e.id, amount: e.pkr_equivalent, sign: -1,
      description: `Credit Note${e.reason ? ` — ${e.reason}` : ''}${e.reference ? ` (Ref: ${e.reference})` : ''}`,
    })),
  ]
  return assemble(customer, events, from, to)
}

export async function buildSupplierLedger(
  admin: Admin, tenantId: string, supplierId: string, from: string | null, to: string | null,
): Promise<PartyLedger | null> {
  const [{ data: supplier }, { data: purchases }, { data: payments }, { data: returns }, { data: debitNotes }, { data: lots }] = await Promise.all([
    admin.from('suppliers').select('id, name, opening_balance_pkr_equivalent, created_at').eq('id', supplierId).eq('tenant_id', tenantId).single(),
    admin.from('purchase_orders').select('id, date, stock_item_id, quantity, rate, currency_code, pkr_equivalent, advance_paid').eq('supplier_id', supplierId).eq('tenant_id', tenantId),
    admin.from('ap_payments').select('id, date, pkr_equivalent, payment_method_note').eq('supplier_id', supplierId).eq('tenant_id', tenantId),
    admin.from('purchase_returns').select('id, date, stock_item_id, quantity, pkr_equivalent, reason').eq('supplier_id', supplierId).eq('tenant_id', tenantId),
    admin.from('debit_notes').select('id, date, pkr_equivalent, reason, reference').eq('supplier_id', supplierId).eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
  ])
  if (!supplier) return null

  const lotMap = new Map((lots ?? []).map((l) => [l.id, l.name]))
  const events: LedgerEvent[] = [
    // The advance is already paid at purchase time, so only the net is owed.
    ...(purchases ?? []).map((e): LedgerEvent => ({
      date: e.date, type: 'purchase', id: e.id, amount: e.pkr_equivalent - e.advance_paid, sign: 1,
      description: `Purchase — ${lotMap.get(e.stock_item_id) ?? unknownItem} (${e.quantity} @ ${e.currency_code} ${e.rate})`,
    })),
    ...(payments ?? []).map((e): LedgerEvent => ({
      date: e.date, type: 'payment', id: e.id, amount: e.pkr_equivalent, sign: -1,
      description: `Payment${e.payment_method_note ? ` — ${e.payment_method_note}` : ''}`,
    })),
    ...(returns ?? []).map((e): LedgerEvent => ({
      date: e.date, type: 'purchase_return', id: e.id, amount: e.pkr_equivalent, sign: -1,
      description: `Purchase Return — ${lotMap.get(e.stock_item_id) ?? unknownItem} (${e.quantity} units${e.reason ? ` — ${e.reason}` : ''})`,
    })),
    ...(debitNotes ?? []).map((e): LedgerEvent => ({
      date: e.date, type: 'debit_note', id: e.id, amount: e.pkr_equivalent, sign: -1,
      description: `Debit Note${e.reason ? ` — ${e.reason}` : ''}${e.reference ? ` (Ref: ${e.reference})` : ''}`,
    })),
  ]
  return assemble(supplier, events, from, to)
}
