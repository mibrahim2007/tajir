// Invoice-wise settlement check — run with `npm run check:invoice-allocation`.
//
// 1. Pure cases for settleParty: a receipt / payment applied to an invoice
//    settles THAT invoice, unapplied money still goes oldest-first, and
//    over-applied or orphaned allocations fall back to FIFO instead of
//    vanishing.
// 2. Live invariants, per tenant (needs env pointing at the live database):
//      • customers: invoice-wise pending == ledger outstanding (opening +
//        sales − receipts − returns − credit notes + refunds)
//      • suppliers: invoice-wise pending == ledger outstanding (opening +
//        purchases net of advance − payments − direct payments − returns −
//        debit notes + refunds)
//    whenever that balance is owed. Allocations only move money between
//    invoices; they must never change what a party owes.

import { settleParty, OPENING_KEY } from '@/lib/settlement/invoice-settlement'
import { loadInvoiceReceivables } from '@/lib/receivables/invoice-receivables'
import { loadInvoicePayables } from '@/lib/payables/invoice-payables'
import { fetchDirectPayments, sumBySupplier } from '@/lib/ledger/direct-payments'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}
const near = (a: number, b: number) => Math.abs(a - b) < 0.02

const doc = (key: string, date: string, amount: number, isOpening = false) => ({
  key, invoiceId: isOpening ? null : key, isOpening, date, dueDate: null, serial: key, ref: null, amount,
})

// ── Pure cases ─────────────────────────────────────────────────────────────
{
  const docs = [doc('A', '2026-01-01', 100), doc('B', '2026-02-01', 100), doc('C', '2026-03-01', 100)]
  type Result = ReturnType<typeof settleParty>
  const bal = (r: Result, k: string) => r.docs.find((d) => d.key === k)!.balance

  const fifo = settleParty(docs, [], 150)
  check('no allocation → oldest first', near(bal(fifo, 'A'), 0) && near(bal(fifo, 'B'), 50) && near(bal(fifo, 'C'), 100))

  const applied = settleParty(docs, [{ key: 'C', amount: 100, kind: 'applied' }], 0)
  check('allocation settles the named invoice', near(bal(applied, 'C'), 0) && near(bal(applied, 'A'), 100))

  const mixed = settleParty(docs, [{ key: 'C', amount: 80, kind: 'applied' }], 70)
  check('applied part to C, rest FIFO to A', near(bal(mixed, 'C'), 20) && near(bal(mixed, 'A'), 30) && near(bal(mixed, 'B'), 100))

  const over = settleParty(docs, [{ key: 'B', amount: 130, kind: 'applied' }], 0)
  check('over-applied excess spills to FIFO', near(bal(over, 'B'), 0) && near(bal(over, 'A'), 70))

  const orphan = settleParty(docs, [{ key: 'deleted-invoice', amount: 50, kind: 'applied' }], 0)
  check('orphaned allocation falls back to FIFO', near(bal(orphan, 'A'), 50))

  const withOpening = settleParty([...docs, doc(OPENING_KEY, '2026-06-01', 40, true)], [], 60)
  check('opening balance is settled before invoices', near(bal(withOpening, OPENING_KEY), 0) && near(bal(withOpening, 'A'), 80))

  const ret = settleParty(docs, [{ key: 'B', amount: 30, kind: 'returned' }], 0)
  check('linked return reduces its own invoice', near(bal(ret, 'B'), 70) && ret.docs.find((d) => d.key === 'B')!.returned === 30)

  const advance = settleParty(docs, [], 400)
  check('surplus becomes unapplied credit', near(advance.unappliedCredit, 100) && advance.docs.every((d) => near(d.balance, 0)))
}

// ── Live invariants ────────────────────────────────────────────────────────
type Row = { pkr_equivalent: number } & Record<string, unknown>
const sumFor = (rows: Row[] | null, col: string, id: string, value: (r: Row) => number = (r) => Number(r.pkr_equivalent)) =>
  (rows ?? []).filter((x) => x[col] === id).reduce((a, x) => a + value(x), 0)

async function live() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log('SKIP  live invariants (no env)')
    return
  }
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data: tenants, error } = await admin.from('tenants').select('id, name')
  if (error || !tenants?.length) {
    check('live invariants: load tenants', false, error?.message ?? 'no tenants — is the env pointing at the live database?')
    return
  }
  for (const t of tenants) {
    // Customers
    const [customers, { data: c }, { data: s }, { data: r }, { data: sr }, { data: cn }, { data: rf }] = await Promise.all([
      loadInvoiceReceivables(admin, t.id),
      admin.from('tajir_customers').select('id, opening_balance_pkr_equivalent').eq('tenant_id', t.id),
      admin.from('sales_orders').select('customer_id, pkr_equivalent').eq('tenant_id', t.id),
      admin.from('ar_receipts').select('customer_id, pkr_equivalent').eq('tenant_id', t.id),
      admin.from('sale_returns').select('customer_id, pkr_equivalent').eq('tenant_id', t.id),
      admin.from('credit_notes').select('customer_id, pkr_equivalent').eq('tenant_id', t.id),
      admin.from('customer_refunds').select('customer_id, pkr_equivalent').eq('tenant_id', t.id),
    ])
    let bad = 0
    for (const p of customers) {
      const opening = Number(c?.find((x) => x.id === p.partyId)?.opening_balance_pkr_equivalent ?? 0)
      const ledger = Math.max(opening, 0) + sumFor(s, 'customer_id', p.partyId) - sumFor(r, 'customer_id', p.partyId)
        - sumFor(sr, 'customer_id', p.partyId) - sumFor(cn, 'customer_id', p.partyId) + sumFor(rf, 'customer_id', p.partyId)
      if (ledger > 0.01 && !near(p.docs.reduce((a, d) => a + d.balance, 0), ledger)) bad++
    }
    check(`${t.name}: customers invoice-wise == ledger`, bad === 0, `${customers.length} customers${bad ? `, ${bad} mismatched` : ''}`)

    // Suppliers
    const [suppliers, { data: sp }, { data: po }, { data: pm }, { data: pr }, { data: dn }, { data: srf }, direct] = await Promise.all([
      loadInvoicePayables(admin, t.id),
      admin.from('suppliers').select('id, opening_balance_pkr_equivalent').eq('tenant_id', t.id),
      admin.from('purchase_orders').select('supplier_id, pkr_equivalent, advance_paid').eq('tenant_id', t.id),
      admin.from('ap_payments').select('supplier_id, pkr_equivalent').eq('tenant_id', t.id),
      admin.from('purchase_returns').select('supplier_id, pkr_equivalent').eq('tenant_id', t.id),
      admin.from('debit_notes').select('supplier_id, pkr_equivalent').eq('tenant_id', t.id),
      admin.from('supplier_refunds').select('supplier_id, pkr_equivalent').eq('tenant_id', t.id),
      fetchDirectPayments(admin, t.id),
    ])
    const directBy = sumBySupplier(direct)
    bad = 0
    for (const p of suppliers) {
      const opening = Number(sp?.find((x) => x.id === p.partyId)?.opening_balance_pkr_equivalent ?? 0)
      const ledger = Math.max(opening, 0)
        + sumFor(po, 'supplier_id', p.partyId, (x) => Number(x.pkr_equivalent) - Number(x.advance_paid))
        - sumFor(pm, 'supplier_id', p.partyId) - (directBy.get(p.partyId) ?? 0)
        - sumFor(pr, 'supplier_id', p.partyId) - sumFor(dn, 'supplier_id', p.partyId) + sumFor(srf, 'supplier_id', p.partyId)
      if (ledger > 0.01 && !near(p.docs.reduce((a, d) => a + d.balance, 0), ledger)) bad++
    }
    check(`${t.name}: suppliers invoice-wise == ledger`, bad === 0, `${suppliers.length} suppliers${bad ? `, ${bad} mismatched` : ''}`)
  }
}

live().then(() => {
  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
  process.exit(failures === 0 ? 0 : 1)
})
