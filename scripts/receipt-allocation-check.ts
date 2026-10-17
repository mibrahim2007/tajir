// Receipt-against-invoice check — run with `npm run check:receipt-allocation`.
//
// 1. Pure cases for settleCustomer: a receipt applied to an invoice settles
//    THAT invoice, unapplied money still goes oldest-first, and over-applied
//    or orphaned allocations fall back to FIFO instead of vanishing.
// 2. Live invariant, per tenant (needs .env.local): the invoice-wise pending
//    total for every customer equals their ledger outstanding (opening + sales
//    − receipts − returns − credit notes + refunds) whenever that is a debit.
//    Allocations only move money between invoices; they must never change
//    what a customer owes.

import { settleCustomer, loadInvoiceReceivables, OPENING_KEY } from '@/lib/receivables/invoice-receivables'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}
const near = (a: number, b: number) => Math.abs(a - b) < 0.02

const doc = (key: string, date: string, amount: number, isOpening = false) => ({
  key, invoiceId: isOpening ? null : key, isOpening, date, dueDate: null, serial: key, poNo: null, amount,
})

// ── Pure cases ─────────────────────────────────────────────────────────────
{
  const docs = [doc('A', '2026-01-01', 100), doc('B', '2026-02-01', 100), doc('C', '2026-03-01', 100)]
  const bal = (r: ReturnType<typeof settleCustomer>, k: string) => r.docs.find((d) => d.key === k)!.balance

  const fifo = settleCustomer(docs, [], 150)
  check('no allocation → oldest first', near(bal(fifo, 'A'), 0) && near(bal(fifo, 'B'), 50) && near(bal(fifo, 'C'), 100))

  const applied = settleCustomer(docs, [{ key: 'C', amount: 100, kind: 'received' }], 0)
  check('allocation settles the named invoice', near(bal(applied, 'C'), 0) && near(bal(applied, 'A'), 100))

  const mixed = settleCustomer(docs, [{ key: 'C', amount: 80, kind: 'received' }], 70)
  check('applied part to C, rest FIFO to A', near(bal(mixed, 'C'), 20) && near(bal(mixed, 'A'), 30) && near(bal(mixed, 'B'), 100))

  const over = settleCustomer(docs, [{ key: 'B', amount: 130, kind: 'received' }], 0)
  check('over-applied excess spills to FIFO', near(bal(over, 'B'), 0) && near(bal(over, 'A'), 70))

  const orphan = settleCustomer(docs, [{ key: 'deleted-invoice', amount: 50, kind: 'received' }], 0)
  check('orphaned allocation falls back to FIFO', near(bal(orphan, 'A'), 50))

  const withOpening = settleCustomer([...docs, doc(OPENING_KEY, '2026-06-01', 40, true)], [], 60)
  check('opening balance is settled before invoices', near(bal(withOpening, OPENING_KEY), 0) && near(bal(withOpening, 'A'), 80))

  const ret = settleCustomer(docs, [{ key: 'B', amount: 30, kind: 'returned' }], 0)
  check('linked return reduces its own invoice', near(bal(ret, 'B'), 70) && ret.docs.find((d) => d.key === 'B')!.returned === 30)

  const advance = settleCustomer(docs, [], 400)
  check('surplus becomes unapplied credit', near(advance.unappliedCredit, 100) && advance.docs.every((d) => near(d.balance, 0)))
}

// ── Live invariant ─────────────────────────────────────────────────────────
async function live() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log('SKIP  live invariant (no .env.local)')
    return
  }
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data: tenants, error } = await admin.from('tenants').select('id, name')
  if (error || !tenants?.length) {
    check('live invariant: load tenants', false, error?.message ?? 'no tenants — is .env.local pointing at the live database?')
    return
  }
  for (const t of tenants ?? []) {
    const [customers, { data: c }, { data: s }, { data: r }, { data: sr }, { data: cn }, { data: rf }] = await Promise.all([
      loadInvoiceReceivables(admin, t.id),
      admin.from('tajir_customers').select('id, opening_balance_pkr_equivalent').eq('tenant_id', t.id),
      admin.from('sales_orders').select('customer_id, pkr_equivalent').eq('tenant_id', t.id),
      admin.from('ar_receipts').select('customer_id, pkr_equivalent').eq('tenant_id', t.id),
      admin.from('sale_returns').select('customer_id, pkr_equivalent').eq('tenant_id', t.id),
      admin.from('credit_notes').select('customer_id, pkr_equivalent').eq('tenant_id', t.id),
      admin.from('customer_refunds').select('customer_id, pkr_equivalent').eq('tenant_id', t.id),
    ])
    const sum = (rows: { customer_id: string; pkr_equivalent: number }[] | null, id: string) =>
      (rows ?? []).filter((x) => x.customer_id === id).reduce((a, x) => a + Number(x.pkr_equivalent), 0)
    let mismatches = 0
    for (const cust of customers) {
      const opening = Number(c?.find((x) => x.id === cust.customerId)?.opening_balance_pkr_equivalent ?? 0)
      const ledger = Math.max(opening, 0) + sum(s, cust.customerId) - sum(r, cust.customerId) - sum(sr, cust.customerId) - sum(cn, cust.customerId) + sum(rf, cust.customerId)
      const pending = cust.docs.reduce((a, d) => a + d.balance, 0)
      if (ledger > 0.01 && !near(pending, ledger)) mismatches++
    }
    check(`${t.name}: invoice-wise pending == ledger outstanding`, mismatches === 0, `${customers.length} customers${mismatches ? `, ${mismatches} mismatched` : ''}`)
  }
}

live().then(() => {
  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
  process.exit(failures === 0 ? 0 : 1)
})
