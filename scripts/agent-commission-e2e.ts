/**
 * Agent commission end-to-end check — `npm run check:agent-commission-e2e`.
 *
 * `check:agent-commission` pins the arithmetic in isolation. This one proves the
 * whole financial path actually works against a real database: account
 * resolution by system_key, voucher allocation, the agent_id sub-ledger
 * dimension, accrual upsert-on-edit, and payout settlement.
 *
 * It exercises the SAME helpers the six invoice server actions call
 * (`resolveAgentCommission` → `commissionJournalLines` → `postJournalEntry` →
 * `syncAgentCommission`), so a break in the commission engine or the posting
 * engine fails here. It does NOT go through the server actions themselves —
 * those need a request context for `requireAuth()` — so the thin wrapper around
 * these calls (zod parsing, role checks, inventory rollback) is out of scope.
 *
 * SAFETY: runs against ONE tenant, creates everything it needs, and removes
 * every row it created in reverse dependency order — including on failure. It
 * refuses to start unless the target tenant is completely empty of ledger
 * activity, so it can never be pointed at a live book by accident.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { repostJournalEntry } from '@/lib/accounting/repost-journal-entry'
import { nextDocumentSerial } from '@/lib/serials/next-serial'
import {
  resolveAgentCommission,
  commissionJournalLines,
  syncAgentCommission,
  clearAgentCommission,
  AGENT_PAYABLE_KEY,
  COMMISSION_EXPENSE_KEY,
} from '@/lib/agents/apply-commission'
import {
  resolveCommissionClawback,
  clawbackJournalLines,
  syncCommissionClawback,
  clearCommissionClawback,
} from '@/lib/agents/clawback'

// Your own tenant: "jAPPX Trader". Overridable, but the emptiness guard below
// still applies to whatever it is pointed at.
const TENANT_ID = process.env.E2E_TENANT_ID ?? '4be76f3d-ecd1-4978-a857-1a08088b8080'

const admin = createAdminClient()

// The seed and teardown helpers below are generic over table NAME, which the
// generated Database types cannot express through a single `from()` overload —
// every call would have to be spelled out literally. This alias keeps that
// looseness confined to those two helpers; every assertion still goes through
// the fully-typed `admin`.
type LooseClient = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => {
      select: (cols: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> }
    }
    delete: () => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
    }
    select: (cols: string, opts: { count: 'exact'; head: true }) => {
      eq: (col: string, val: string) => Promise<{ count: number | null; error: { message: string } | null }>
    }
  }
}
const loose = admin as unknown as LooseClient

const today = new Date().toISOString().split('T')[0]

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`)
}

/**
 * Unwraps a Supabase result, throwing if the query itself failed.
 *
 * This matters more than it looks. A failed query returns `{ data: null }` and
 * `{ count: null }` — indistinguishable from "the row isn't there" and "the
 * table is empty" unless you read `.error`. Both of this script's SAFETY
 * mechanisms consume exactly those two shapes: the guard that refuses to run
 * against a non-empty tenant, and the teardown check that proves every test row
 * was removed. Left unchecked they fail OPEN — a transport blip reads as "empty
 * tenant, safe to proceed" and then as "cleanup verified". Never infer absence
 * from a null you haven't error-checked.
 */
function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

function mustCount(res: { count: number | null; error: { message: string } | null }, what: string): number {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  if (res.count === null) throw new Error(`${what}: query returned no count`)
  return res.count
}
function near(a: number, b: number) {
  return Math.abs(a - b) < 0.01
}

// Everything created, newest first — teardown walks this in order.
const created: { table: string; id: string }[] = []
function track(table: string, id: string) {
  created.unshift({ table, id })
}

/** The GL entry for a source document, reduced to system_key → {debit, credit, agentId}. */
async function readEntry(sourceType: string, sourceId: string) {
  // Error-checked: a failed read here would otherwise look like "no entry",
  // silently turning a posting assertion into a false pass.
  const entry = must(
    await admin
      .from('tajir_journal_entries')
      .select('id, voucher_number, description')
      .eq('tenant_id', TENANT_ID).eq('source_type', sourceType).eq('source_id', sourceId)
      .maybeSingle(),
    `read ${sourceType} entry`,
  )
  if (!entry) return null

  const lines = must(
    await admin
      .from('tajir_journal_entry_lines')
      .select('debit, credit, agent_id, chart_of_accounts!inner(system_key, code)')
      .eq('journal_entry_id', entry.id),
    `read ${sourceType} entry lines`,
  )

  const byKey = new Map<string, { debit: number; credit: number; agentId: string | null }>()
  let totalDebit = 0
  let totalCredit = 0
  for (const l of (lines ?? []) as unknown as {
    debit: number; credit: number; agent_id: string | null
    chart_of_accounts: { system_key: string | null; code: string }
  }[]) {
    const key = l.chart_of_accounts.system_key ?? `code:${l.chart_of_accounts.code}`
    const prev = byKey.get(key) ?? { debit: 0, credit: 0, agentId: null }
    byKey.set(key, {
      debit: prev.debit + Number(l.debit),
      credit: prev.credit + Number(l.credit),
      agentId: prev.agentId ?? l.agent_id,
    })
    totalDebit += Number(l.debit)
    totalCredit += Number(l.credit)
  }
  return { entry, byKey, totalDebit, totalCredit }
}

async function main() {
  // ── Guard: refuse to touch a tenant that has any ledger activity ──
  const [tenantRes, entriesRes, salesRes, purchasesRes] = await Promise.all([
    admin.from('tenants').select('id, name').eq('id', TENANT_ID).maybeSingle(),
    admin.from('tajir_journal_entries').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    admin.from('sales_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    admin.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
  ])

  // Error-check BEFORE reading any of these, so a failed query can never be
  // mistaken for an empty tenant and wave the run through.
  const tenant = must(tenantRes, 'tenant lookup')
  const existingEntries = mustCount(entriesRes, 'journal entry count')
  const existingSales = mustCount(salesRes, 'sales order count')
  const existingPurchases = mustCount(purchasesRes, 'purchase order count')

  if (!tenant) throw new Error(`Tenant ${TENANT_ID} does not exist`)
  const activity = existingEntries + existingSales + existingPurchases
  if (activity > 0) {
    throw new Error(
      `Refusing to run: tenant "${tenant.name}" already has ledger activity ` +
        `(${existingEntries} entries, ${existingSales} sales, ${existingPurchases} purchases). ` +
        `This check only runs against an empty tenant.`,
    )
  }
  console.log(`Target tenant: ${tenant.name} (${TENANT_ID}) — empty, proceeding.\n`)

  // ── Master data ──────────────────────────────────────────────────
  const mk = async (table: string, row: Record<string, unknown>) => {
    const { data, error } = await loose.from(table).insert({ tenant_id: TENANT_ID, ...row }).select('id').single()
    if (error || !data) throw new Error(`insert ${table}: ${error?.message}`)
    track(table, data.id)
    return data.id
  }

  const customerId = await mk('tajir_customers', { name: 'E2E Customer' })
  const supplierId = await mk('suppliers', { name: 'E2E Supplier' })
  const locationId = await mk('locations', { name: 'E2E Warehouse' })
  const lotId = await mk('inventory_lots', { name: 'E2E Yarn Lot', current_quantity: 0, opening_rate: 0 })

  // Sales 1.5%; purchases Rs 10 per unit — deliberately different bases, which
  // is the whole point of configuring the two sides independently.
  const agentId = await mk('agents', {
    name: 'E2E Broker',
    sale_commission_type: 'percentage',     sale_commission_rate: 1.5,
    purchase_commission_type: 'per_unit',   purchase_commission_rate: 10,
  })

  // ── 1. Sale invoice: commission accrues on a percentage basis ────
  const saleQty = 200
  const saleRate = 500
  const saleValue = saleQty * saleRate            // 100,000
  const expectedSaleCommission = saleValue * 0.015 // 1,500

  const saleInvoiceId = crypto.randomUUID()
  const saleSerial = await nextDocumentSerial(admin, TENANT_ID, 'sale_invoice', today)
  const saleOrderId = await mk('sales_orders', {
    serial_number: saleSerial, customer_id: customerId, stock_item_id: lotId,
    quantity: saleQty, rate: saleRate, currency_code: 'PKR', exchange_rate: 1,
    pkr_equivalent: saleValue, date: today, location_id: locationId,
    invoice_id: saleInvoiceId, agent_id: agentId, confirmed_at: new Date().toISOString(),
  })

  const saleResolved = await resolveAgentCommission(admin, TENANT_ID, {
    agentId, side: 'sale', baseAmount: saleValue, baseQuantity: saleQty,
  })
  if (!saleResolved.ok) throw new Error(`resolve failed: ${saleResolved.error}`)
  const saleAccrual = saleResolved.accrual

  check('sale: commission resolves off the agent\'s enrolled sale terms',
    !!saleAccrual && near(saleAccrual.amount, expectedSaleCommission),
    `expected ${expectedSaleCommission}, got ${saleAccrual?.amount}`)

  const salePosted = await postJournalEntry({
    tenantId: TENANT_ID, date: today, description: 'Sale Invoice', reference: saleSerial,
    sourceType: 'sale_invoice', sourceId: saleInvoiceId, prefix: 'SI',
    lines: [
      { accountSystemKey: 'accounts_receivable', debit: saleValue, credit: 0, customerId },
      { accountSystemKey: 'sales_revenue', debit: 0, credit: saleValue, customerId },
      { accountSystemKey: 'cogs', debit: saleValue, credit: 0, stockItemId: lotId },
      { accountSystemKey: 'inventory', debit: 0, credit: saleValue, stockItemId: lotId },
      ...commissionJournalLines(saleAccrual),
    ],
  })
  check('sale: journal entry posts', salePosted.ok,
    salePosted.ok ? `voucher ${salePosted.voucherNumber}` : salePosted.message)
  if (salePosted.ok) track('tajir_journal_entries__by_source', `sale_invoice:${saleInvoiceId}`)

  await syncAgentCommission(admin, {
    tenantId: TENANT_ID, accrual: saleAccrual, sourceType: 'sale_invoice',
    sourceId: saleInvoiceId, documentSerial: saleSerial, partyName: 'E2E Customer', date: today,
  })

  const saleGl = await readEntry('sale_invoice', saleInvoiceId)
  check('sale: entry balances', !!saleGl && near(saleGl.totalDebit, saleGl.totalCredit),
    saleGl ? `Dr ${saleGl.totalDebit} / Cr ${saleGl.totalCredit}` : 'no entry')
  check('sale: DR Commission Expense equals the accrual',
    !!saleGl && near(saleGl.byKey.get(COMMISSION_EXPENSE_KEY)?.debit ?? 0, expectedSaleCommission),
    `got ${saleGl?.byKey.get(COMMISSION_EXPENSE_KEY)?.debit}`)
  check('sale: CR Agent Commission Payable equals the accrual',
    !!saleGl && near(saleGl.byKey.get(AGENT_PAYABLE_KEY)?.credit ?? 0, expectedSaleCommission),
    `got ${saleGl?.byKey.get(AGENT_PAYABLE_KEY)?.credit}`)
  check('sale: the payable leg carries the agent_id dimension',
    saleGl?.byKey.get(AGENT_PAYABLE_KEY)?.agentId === agentId)
  check('sale: revenue is NOT reduced by the commission',
    !!saleGl && near(saleGl.byKey.get('sales_revenue')?.credit ?? 0, saleValue),
    `expected ${saleValue}, got ${saleGl?.byKey.get('sales_revenue')?.credit}`)

  // ── 2. Purchase invoice: per-unit basis, expensed not capitalised ─
  const buyQty = 300
  const buyRate = 400
  const buyValue = buyQty * buyRate           // 120,000
  const expectedBuyCommission = buyQty * 10   // 3,000 — per unit, NOT a percentage

  const buyInvoiceId = crypto.randomUUID()
  const buySerial = await nextDocumentSerial(admin, TENANT_ID, 'purchase_order', today)
  const buyOrderId = await mk('purchase_orders', {
    serial_number: buySerial, supplier_id: supplierId, stock_item_id: lotId,
    quantity: buyQty, rate: buyRate, currency_code: 'PKR', exchange_rate: 1,
    pkr_equivalent: buyValue, date: today, location_id: locationId,
    invoice_id: buyInvoiceId, agent_id: agentId, confirmed_at: new Date().toISOString(),
  })

  const buyResolved = await resolveAgentCommission(admin, TENANT_ID, {
    agentId, side: 'purchase', baseAmount: buyValue, baseQuantity: buyQty,
  })
  if (!buyResolved.ok) throw new Error(`resolve failed: ${buyResolved.error}`)
  const buyAccrual = buyResolved.accrual

  check('purchase: commission uses the PURCHASE side terms, not the sale side',
    !!buyAccrual && near(buyAccrual.amount, expectedBuyCommission),
    `expected ${expectedBuyCommission} (per-unit), got ${buyAccrual?.amount}`)

  const buyPosted = await postJournalEntry({
    tenantId: TENANT_ID, date: today, description: 'Purchase Invoice', reference: buySerial,
    sourceType: 'purchase_invoice', sourceId: buyInvoiceId, prefix: 'PI',
    lines: [
      { accountSystemKey: 'inventory', debit: buyValue, credit: 0, stockItemId: lotId },
      { accountSystemKey: 'accounts_payable', debit: 0, credit: buyValue, supplierId },
      ...commissionJournalLines(buyAccrual),
    ],
  })
  check('purchase: journal entry posts', buyPosted.ok,
    buyPosted.ok ? `voucher ${buyPosted.voucherNumber}` : buyPosted.message)

  await syncAgentCommission(admin, {
    tenantId: TENANT_ID, accrual: buyAccrual, sourceType: 'purchase_invoice',
    sourceId: buyInvoiceId, documentSerial: buySerial, partyName: 'E2E Supplier', date: today,
  })

  const buyGl = await readEntry('purchase_invoice', buyInvoiceId)
  check('purchase: entry balances', !!buyGl && near(buyGl.totalDebit, buyGl.totalCredit),
    buyGl ? `Dr ${buyGl.totalDebit} / Cr ${buyGl.totalCredit}` : 'no entry')
  // The decision that matters: commission is expensed, so Stock in Trade stays
  // at the supplier's invoice value and lot costing is untouched.
  check('purchase: inventory debited at invoice cost ONLY (commission not capitalised)',
    !!buyGl && near(buyGl.byKey.get('inventory')?.debit ?? 0, buyValue),
    `expected ${buyValue}, got ${buyGl?.byKey.get('inventory')?.debit}`)
  check('purchase: commission hits Commission Expense instead',
    !!buyGl && near(buyGl.byKey.get(COMMISSION_EXPENSE_KEY)?.debit ?? 0, expectedBuyCommission),
    `got ${buyGl?.byKey.get(COMMISSION_EXPENSE_KEY)?.debit}`)
  check('purchase: accounts payable is NOT inflated by the commission',
    !!buyGl && near(buyGl.byKey.get('accounts_payable')?.credit ?? 0, buyValue),
    `expected ${buyValue}, got ${buyGl?.byKey.get('accounts_payable')?.credit}`)

  // ── 3. Edit the sale: accrual restates, never stacks ──────────────
  const newSaleValue = 60_000                       // halved-ish
  const newSaleQty = 120
  const expectedNewCommission = newSaleValue * 0.015 // 900

  const editResolved = await resolveAgentCommission(admin, TENANT_ID, {
    agentId, side: 'sale', baseAmount: newSaleValue, baseQuantity: newSaleQty,
  })
  if (!editResolved.ok) throw new Error(`resolve failed: ${editResolved.error}`)

  const reposted = await repostJournalEntry({
    tenantId: TENANT_ID, date: today, description: 'Sale Invoice', reference: saleSerial ?? undefined,
    sourceType: 'sale_invoice', sourceId: saleInvoiceId, prefix: 'SI',
    lines: [
      { accountSystemKey: 'accounts_receivable', debit: newSaleValue, credit: 0, customerId },
      { accountSystemKey: 'sales_revenue', debit: 0, credit: newSaleValue, customerId },
      { accountSystemKey: 'cogs', debit: newSaleValue, credit: 0, stockItemId: lotId },
      { accountSystemKey: 'inventory', debit: 0, credit: newSaleValue, stockItemId: lotId },
      ...commissionJournalLines(editResolved.accrual),
    ],
  })
  check('edit: re-post succeeds', reposted.ok, reposted.ok ? '' : reposted.message)
  check('edit: voucher number is preserved across the edit',
    reposted.ok && salePosted.ok && reposted.voucherNumber === salePosted.voucherNumber,
    reposted.ok && salePosted.ok ? `${salePosted.voucherNumber} → ${reposted.voucherNumber}` : '')

  await syncAgentCommission(admin, {
    tenantId: TENANT_ID, accrual: editResolved.accrual, sourceType: 'sale_invoice',
    sourceId: saleInvoiceId, documentSerial: saleSerial, partyName: 'E2E Customer', date: today,
  })

  const editGl = await readEntry('sale_invoice', saleInvoiceId)
  check('edit: commission restated to the new value',
    !!editGl && near(editGl.byKey.get(COMMISSION_EXPENSE_KEY)?.debit ?? 0, expectedNewCommission),
    `expected ${expectedNewCommission}, got ${editGl?.byKey.get(COMMISSION_EXPENSE_KEY)?.debit}`)

  const accrualRows = mustCount(
    await admin
      .from('agent_commissions').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).eq('source_type', 'sale_invoice').eq('source_id', saleInvoiceId),
    'accrual row count after edit',
  )
  check('edit: still exactly ONE accrual row (upsert, not a second accrual)',
    accrualRows === 1, `found ${accrualRows}`)

  // ── 4. Sale return: partial clawback on a percentage basis ───────
  // Books a return the same way createSaleReturnAction does, then asserts the
  // reversal. The sale accrual now stands at 900 (60,000 @ 1.5%).
  const postReturn = async (
    side: 'sale' | 'purchase',
    opts: { orderId: string; value: number; qty: number; partyId: string },
  ) => {
    const table = side === 'sale' ? 'sale_returns' : 'purchase_returns'
    const docType = side === 'sale' ? 'sale_return' : 'purchase_return'
    const serial = await nextDocumentSerial(admin, TENANT_ID, docType, today)
    const retId = await mk(table, {
      serial_number: serial,
      [side === 'sale' ? 'sale_order_id' : 'purchase_order_id']: opts.orderId,
      [side === 'sale' ? 'customer_id' : 'supplier_id']: opts.partyId,
      stock_item_id: lotId, quantity: opts.qty, rate: opts.value / opts.qty,
      currency_code: 'PKR', exchange_rate: 1, pkr_equivalent: opts.value, date: today,
    })
    const resolved = await resolveCommissionClawback(admin, TENANT_ID, {
      side, orderId: opts.orderId, returnedValue: opts.value, returnedQuantity: opts.qty,
    })
    if (!resolved.ok) throw new Error(`clawback resolve failed: ${resolved.error}`)
    const cb = resolved.clawback

    const legs = side === 'sale'
      ? [
          { accountSystemKey: 'sales_returns_contra', debit: opts.value, credit: 0, customerId: opts.partyId },
          { accountSystemKey: 'accounts_receivable', debit: 0, credit: opts.value, customerId: opts.partyId },
          { accountSystemKey: 'inventory', debit: opts.value, credit: 0, stockItemId: lotId },
          { accountSystemKey: 'cogs', debit: 0, credit: opts.value, stockItemId: lotId },
        ]
      : [
          { accountSystemKey: 'accounts_payable', debit: opts.value, credit: 0, supplierId: opts.partyId },
          { accountSystemKey: 'inventory', debit: 0, credit: opts.value, stockItemId: lotId },
        ]

    const posted = await postJournalEntry({
      tenantId: TENANT_ID, date: today,
      description: side === 'sale' ? 'Sale Return' : 'Purchase Return',
      reference: serial, sourceType: docType, sourceId: retId,
      prefix: side === 'sale' ? 'SR' : 'PR',
      lines: [...legs, ...clawbackJournalLines(cb)],
    })
    await syncCommissionClawback(admin, {
      tenantId: TENANT_ID, clawback: cb, sourceType: docType,
      sourceId: retId, documentSerial: serial, date: today,
    })
    return { retId, cb, posted, docType }
  }

  const ret1 = await postReturn('sale', { orderId: saleOrderId, value: 20_000, qty: 40, partyId: customerId })
  check('return: partial sale return claws back pro-rata at the ACCRUAL\'s rate',
    !!ret1.cb && near(ret1.cb.amount, 300), `expected 300 (20,000 @ 1.5%), got ${ret1.cb?.amount}`)
  check('return: the reversal entry balances', ret1.posted.ok)

  const ret1Gl = await readEntry(ret1.docType, ret1.retId)
  check('return: DR Agent Commission Payable (the mirror of the accrual)',
    !!ret1Gl && near(ret1Gl.byKey.get(AGENT_PAYABLE_KEY)?.debit ?? 0, 300),
    `got ${ret1Gl?.byKey.get(AGENT_PAYABLE_KEY)?.debit}`)
  check('return: CR Commission Expense',
    !!ret1Gl && near(ret1Gl.byKey.get(COMMISSION_EXPENSE_KEY)?.credit ?? 0, 300),
    `got ${ret1Gl?.byKey.get(COMMISSION_EXPENSE_KEY)?.credit}`)

  const storedClawback = must(
    await admin.from('agent_commissions')
      .select('amount, related_invoice_id, source_type')
      .eq('tenant_id', TENANT_ID).eq('source_type', 'sale_return').eq('source_id', ret1.retId).maybeSingle(),
    'read clawback row',
  )
  check('return: clawback stored NEGATIVE so the balance is a plain sum',
    !!storedClawback && near(Number(storedClawback.amount), -300), `got ${storedClawback?.amount}`)
  check('return: clawback is linked to the invoice it reverses',
    storedClawback?.related_invoice_id === saleInvoiceId)

  // ── 5. The cap: cumulative clawback can never exceed the accrual ──
  // Deliberately return far more value than the invoice ever carried. Raw
  // maths says 1,500; only 600 of the 900 accrual is left, so 600 is the answer.
  const ret2 = await postReturn('sale', { orderId: saleOrderId, value: 100_000, qty: 200, partyId: customerId })
  check('return: over-return is CAPPED at the commission actually earned',
    !!ret2.cb && near(ret2.cb.amount, 600),
    `expected 600 (900 accrued − 300 already reversed), got ${ret2.cb?.amount}`)
  check('return: the cap is reported, not silently applied', ret2.cb?.cappedToRemaining === true)

  const saleNet = (must(
    await admin.from('agent_commissions').select('amount')
      .eq('tenant_id', TENANT_ID)
      .or(`source_id.eq.${saleInvoiceId},related_invoice_id.eq.${saleInvoiceId}`),
    'sum sale-invoice commission',
  ) ?? []).reduce((s, r) => s + Number(r.amount), 0)
  check('return: a fully-reversed invoice nets to exactly zero commission',
    near(saleNet, 0), `net ${saleNet}`)

  // ── 6. Purchase return reverses on the PER-UNIT basis ────────────
  const ret3 = await postReturn('purchase', { orderId: buyOrderId, value: 40_000, qty: 100, partyId: supplierId })
  check('return: purchase return reverses per-unit, not pro-rata by value',
    !!ret3.cb && near(ret3.cb.amount, 1_000),
    `expected 1,000 (100 units × Rs 10), got ${ret3.cb?.amount}`)

  // ── 7. A flat fee is all-or-nothing ──────────────────────────────
  const flatAgentId = await mk('agents', {
    name: 'E2E Flat Broker',
    sale_commission_type: 'flat', sale_commission_rate: 5_000,
    purchase_commission_type: 'none', purchase_commission_rate: 0,
  })
  const flatInvoiceId = crypto.randomUUID()
  const flatSerial = await nextDocumentSerial(admin, TENANT_ID, 'sale_invoice', today)
  const flatOrderId = await mk('sales_orders', {
    serial_number: flatSerial, customer_id: customerId, stock_item_id: lotId,
    quantity: 100, rate: 500, currency_code: 'PKR', exchange_rate: 1,
    pkr_equivalent: 50_000, date: today, location_id: locationId,
    invoice_id: flatInvoiceId, agent_id: flatAgentId, confirmed_at: new Date().toISOString(),
  })
  const flatResolved = await resolveAgentCommission(admin, TENANT_ID, {
    agentId: flatAgentId, side: 'sale', baseAmount: 50_000, baseQuantity: 100,
  })
  if (!flatResolved.ok) throw new Error(flatResolved.error)
  check('flat: the fee does not scale with invoice value',
    !!flatResolved.accrual && near(flatResolved.accrual.amount, 5_000),
    `got ${flatResolved.accrual?.amount}`)
  await postJournalEntry({
    tenantId: TENANT_ID, date: today, description: 'Sale Invoice', reference: flatSerial,
    sourceType: 'sale_invoice', sourceId: flatInvoiceId, prefix: 'SI',
    lines: [
      { accountSystemKey: 'accounts_receivable', debit: 50_000, credit: 0, customerId },
      { accountSystemKey: 'sales_revenue', debit: 0, credit: 50_000, customerId },
      ...commissionJournalLines(flatResolved.accrual),
    ],
  })
  await syncAgentCommission(admin, {
    tenantId: TENANT_ID, accrual: flatResolved.accrual, sourceType: 'sale_invoice',
    sourceId: flatInvoiceId, documentSerial: flatSerial, date: today,
  })

  const flatPartial = await postReturn('sale', { orderId: flatOrderId, value: 10_000, qty: 20, partyId: customerId })
  check('flat: a PARTIAL return reverses nothing (the fee is per introduction)',
    flatPartial.cb === null, `got ${flatPartial.cb?.amount}`)

  const flatFull = await postReturn('sale', { orderId: flatOrderId, value: 40_000, qty: 80, partyId: customerId })
  check('flat: the return that completes the invoice reverses the WHOLE fee',
    !!flatFull.cb && near(flatFull.cb.amount, 5_000), `expected 5,000, got ${flatFull.cb?.amount}`)

  // ── 8. Deleting a return puts the commission back ────────────────
  // Mirrors deletePurchaseReturnAction: drop the GL entry, then the clawback
  // row. Leaving the row behind would keep eating into the cap forever.
  const ret3Entry = must(
    await admin.from('tajir_journal_entries').select('id')
      .eq('tenant_id', TENANT_ID).eq('source_type', 'purchase_return').eq('source_id', ret3.retId).maybeSingle(),
    'read purchase-return entry',
  )
  if (ret3Entry) {
    await admin.from('tajir_journal_entry_lines').delete().eq('journal_entry_id', ret3Entry.id)
    await admin.from('tajir_journal_entries').delete().eq('id', ret3Entry.id)
  }
  await clearCommissionClawback(admin, TENANT_ID, 'purchase_return', ret3.retId)
  await loose.from('purchase_returns').delete().eq('id', ret3.retId)

  const afterReturnDelete = mustCount(
    await admin.from('agent_commissions').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).eq('source_type', 'purchase_return').eq('source_id', ret3.retId),
    'clawback count after deleting the return',
  )
  check('delete return: the clawback row goes with it', afterReturnDelete === 0, `found ${afterReturnDelete}`)

  // With that reversal gone the purchase accrual stands at its full 3,000 again.
  const buyNet = (must(
    await admin.from('agent_commissions').select('amount')
      .eq('tenant_id', TENANT_ID)
      .or(`source_id.eq.${buyInvoiceId},related_invoice_id.eq.${buyInvoiceId}`),
    'sum purchase-invoice commission',
  ) ?? []).reduce((s, r) => s + Number(r.amount), 0)
  check('delete return: the reversed commission is owed again',
    near(buyNet, expectedBuyCommission), `expected ${expectedBuyCommission}, got ${buyNet}`)

  // ── 9. Payout settles what is left after the reversals ───────────
  // Sale invoice fully reversed (0); the purchase return was just deleted, so
  // its 3,000 is owed in full again. The flat invoice belongs to a different
  // agent and is settled separately.
  const owed = expectedBuyCommission
  const paySerial = await nextDocumentSerial(admin, TENANT_ID, 'agent_payment', today)
  check('payout: serial uses the AGP prefix', (paySerial ?? '').startsWith('AGP-'), `got ${paySerial}`)

  const paymentId = await mk('agent_payments', {
    serial_number: paySerial, agent_id: agentId, amount: owed,
    currency_code: 'PKR', exchange_rate: 1, pkr_equivalent: owed, date: today,
  })
  const payPosted = await postJournalEntry({
    tenantId: TENANT_ID, date: today, description: 'Agent Commission Payment', reference: paySerial,
    sourceType: 'agent_payment', sourceId: paymentId, prefix: 'AGP',
    lines: [
      { accountSystemKey: AGENT_PAYABLE_KEY, debit: owed, credit: 0, agentId },
      { accountSystemKey: 'cash_in_hand', debit: 0, credit: owed },
    ],
  })
  check('payout: journal entry posts', payPosted.ok, payPosted.ok ? '' : payPosted.message)

  // The real proof: the agent's dimension on 2150 nets to zero once paid.
  const { data: payableLines } = await admin
    .from('tajir_journal_entry_lines')
    .select('debit, credit, chart_of_accounts!inner(system_key)')
    .eq('tenant_id', TENANT_ID).eq('agent_id', agentId)
  const payable = ((payableLines ?? []) as unknown as {
    debit: number; credit: number; chart_of_accounts: { system_key: string | null }
  }[])
    .filter((l) => l.chart_of_accounts.system_key === AGENT_PAYABLE_KEY)
    .reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0)
  check('payout: agent payable nets to zero after settling in full',
    near(payable, 0), `net credit balance ${payable}`)

  // ── 5. Deleting the sale removes its accrual with it ─────────────
  const { data: saleEntry } = await admin
    .from('tajir_journal_entries').select('id')
    .eq('tenant_id', TENANT_ID).eq('source_type', 'sale_invoice').eq('source_id', saleInvoiceId).maybeSingle()
  if (saleEntry) {
    await admin.from('tajir_journal_entry_lines').delete().eq('journal_entry_id', saleEntry.id)
    await admin.from('tajir_journal_entries').delete().eq('id', saleEntry.id)
  }
  await clearAgentCommission(admin, TENANT_ID, 'sale_invoice', saleInvoiceId)

  const afterDelete = mustCount(
    await admin
      .from('agent_commissions').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).eq('source_type', 'sale_invoice').eq('source_id', saleInvoiceId),
    'accrual row count after delete',
  )
  check('delete: the accrual row goes with the invoice', afterDelete === 0, `found ${afterDelete}`)
  check('delete: the GL entry is gone too',
    (await readEntry('sale_invoice', saleInvoiceId)) === null)
}

/** Reverse-dependency teardown. Runs whether the checks passed or blew up. */
async function teardown() {
  console.log('\nCleaning up…')
  for (const sourceType of ['sale_invoice', 'purchase_invoice', 'sale_return',
                            'purchase_return', 'agent_payment']) {
    const { data: entries } = await admin
      .from('tajir_journal_entries').select('id')
      .eq('tenant_id', TENANT_ID).eq('source_type', sourceType)
    for (const e of entries ?? []) {
      await admin.from('tajir_journal_entry_lines').delete().eq('journal_entry_id', e.id)
      await admin.from('tajir_journal_entries').delete().eq('id', e.id)
    }
  }
  await admin.from('agent_commissions').delete().eq('tenant_id', TENANT_ID)
  await admin.from('agent_payment_lines').delete().eq('tenant_id', TENANT_ID)

  for (const { table, id } of created) {
    if (table.includes('__by_source')) continue
    const { error } = await loose.from(table).delete().eq('id', id)
    if (error) console.error(`  could not delete ${table}/${id}: ${error.message}`)
  }
  await admin.from('document_serials').delete().eq('tenant_id', TENANT_ID)

  // Prove the tenant is back exactly as it was found.
  // Same rule as the guard: a null count here is "I could not check", not
  // "zero". Treating it as zero would report a clean teardown having verified
  // nothing — which is precisely how a stray row would get left behind unseen.
  const counts: Record<string, number> = {}
  const unverifiable: string[] = []
  for (const t of ['agents', 'agent_commissions', 'agent_payments', 'agent_payment_lines',
                   'sales_orders', 'purchase_orders', 'sale_returns', 'purchase_returns',
                   'tajir_journal_entries', 'tajir_customers',
                   'suppliers', 'inventory_lots', 'locations', 'document_serials']) {
    // Count on tenant_id, not id: `document_serials` is keyed on
    // (tenant_id, doc_type, year) and has no id column at all. Selecting `id`
    // errored there, and the old `count ?? 0` read that error as "zero rows" —
    // so this table silently went unverified on every run until now.
    const res = await loose.from(t).select('tenant_id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID)
    if (res.error || res.count === null) { unverifiable.push(t); continue }
    counts[t] = res.count
  }
  const leftovers = Object.entries(counts).filter(([, c]) => c > 0)
  check('teardown: tenant left completely empty',
    leftovers.length === 0 && unverifiable.length === 0,
    unverifiable.length
      ? `COULD NOT VERIFY: ${unverifiable.join(', ')} — check the tenant by hand`
      : leftovers.length
        ? leftovers.map(([t, c]) => `${t}=${c}`).join(', ')
        : `all zero across ${Object.keys(counts).length} tables`)
}

main()
  .catch((e) => { failures++; console.error(`\nFATAL: ${e instanceof Error ? e.message : e}`) })
  .then(teardown)
  .catch((e) => { failures++; console.error(`\nTEARDOWN FAILED: ${e instanceof Error ? e.message : e}`) })
  .finally(() => {
    console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
    process.exit(failures === 0 ? 0 : 1)
  })
