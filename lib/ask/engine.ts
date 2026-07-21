// The Ask engine: turn a typed question into one of a fixed set of safe,
// tenant-scoped queries and format the answer. There is NO external model and
// nothing is inferred — the question only picks which stored-data query to run.
//
// Flow: resolve any customer / supplier / item named in the text, score the
// question against the known intents, then run the winning intent's query
// (a read-only SQL function from migration 0044) and shape the result.

import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import type { AskResponse, AskColumn } from '@/lib/ask/types'
import { ASK_EXAMPLES } from '@/lib/ask/types'

type Entity = { id: string; name: string }

// ── Entity resolution ───────────────────────────────────────────────
// Find the customer/supplier/item named in the question. Prefer a full-name
// substring (longest wins); fall back to distinctive-token overlap so
// "ledger of ali traders" still finds "Ali Traders & Co".
function resolveEntity(lowerQ: string, list: Entity[]): Entity | null {
  let best: Entity | null = null
  for (const e of list) {
    const n = (e.name ?? '').trim().toLowerCase()
    if (n.length < 2) continue
    if (lowerQ.includes(n) && (!best || n.length > best.name.length)) best = e
  }
  if (best) return best

  let bestScore = 0
  for (const e of list) {
    const tokens = (e.name ?? '').toLowerCase().split(/\s+/).filter((t) => t.length >= 3)
    if (!tokens.length) continue
    const hits = tokens.filter((t) => lowerQ.includes(t)).length
    const score = hits / tokens.length
    if (hits >= 1 && score > bestScore) { bestScore = score; best = e }
  }
  return bestScore >= 0.5 ? best : null
}

function parseDays(q: string, def: number): number {
  const m = q.match(/(\d+)\s*(day|days|week|weeks|month|months|year|years)/)
  if (!m) return def
  const n = parseInt(m[1], 10)
  const u = m[2]
  if (u.startsWith('week')) return n * 7
  if (u.startsWith('month')) return n * 30
  if (u.startsWith('year')) return n * 365
  return n
}

// Keywords for intents that need no entity. Multi-word phrases matched as
// substrings; each hit adds a point.
const NONENTITY_KEYWORDS: Record<string, string[]> = {
  slow_items:     ['slow moving', 'slow-moving', 'slow item', 'dead stock', 'non moving', 'non-moving', 'not selling', 'least sold', 'slow stock'],
  slow_customers: ['slow customer', 'inactive customer', 'slow business customer', 'dormant', 'not buying', 'least active', 'idle customer'],
  top_customers:  ['top customer', 'best customer', 'biggest customer', 'top buyer', 'highest sales', 'most business', 'top client'],
  receivables:    ['receivable', 'who owes', 'owes me', 'outstanding customer', 'pending from customer', 'to collect', 'collection'],
  payables:       ['payable', 'who do i owe', 'whom do i owe', 'we owe', 'i owe', 'outstanding supplier', 'pending to supplier'],
  low_stock:      ['low stock', 'out of stock', 'reorder', 'running low', 'least stock', 'low quantity'],
}

type Ctx = {
  admin: ReturnType<typeof createAdminClient>
  tenantId: string
  question: string
  lowerQ: string
  customer: Entity | null
  supplier: Entity | null
  item: Entity | null
}

// ── Runners ─────────────────────────────────────────────────────────
const num = (v: unknown) => Number(v ?? 0)

// The ask_* functions live in migration 0044 but aren't in the generated
// Supabase types, so call them through an untyped view of the client and
// return plain rows.
async function callRpc(
  admin: ReturnType<typeof createAdminClient>,
  fn: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const client = admin as unknown as {
    rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown }>
  }
  const { data } = await client.rpc(fn, args)
  return (data ?? []) as Record<string, unknown>[]
}

async function customerSummary(ctx: Ctx): Promise<AskResponse> {
  const c = ctx.customer!
  const r = (await callRpc(ctx.admin, 'ask_customer_summary', { p_tenant_id: ctx.tenantId, p_customer_id: c.id }))[0] as Record<string, unknown> | undefined
  if (!r) return text(`No activity found for ${c.name} yet.`, followups(c.name))
  const bal = num(r.balance)
  return {
    kind: 'stats',
    title: `${c.name} — business summary`,
    subtitle: r.first_order ? `Since ${fmtDate(r.first_order)} · last order ${fmtDate(r.last_order)}` : undefined,
    stats: [
      { label: 'Total sales',    value: formatPKR(num(r.total_sales)) },
      { label: 'Qty sold',       value: num(r.sales_qty).toLocaleString() },
      { label: 'Orders',         value: String(num(r.order_count)) },
      { label: 'Received',       value: formatPKR(num(r.total_received)) },
      { label: 'Sale returns',   value: formatPKR(num(r.returns_value)) },
      balanceStat(bal, 'customer'),
    ],
    summary: balanceSentence(c.name, bal, 'customer'),
    suggestions: [`Ledger of ${c.name}`, 'Top customers', 'Who owes me money'],
  }
}

async function supplierSummary(ctx: Ctx): Promise<AskResponse> {
  const s = ctx.supplier!
  const r = (await callRpc(ctx.admin, 'ask_supplier_summary', { p_tenant_id: ctx.tenantId, p_supplier_id: s.id }))[0] as Record<string, unknown> | undefined
  if (!r) return text(`No activity found for ${s.name} yet.`)
  const bal = num(r.balance)
  return {
    kind: 'stats',
    title: `${s.name} — business summary`,
    subtitle: r.first_order ? `Since ${fmtDate(r.first_order)} · last purchase ${fmtDate(r.last_order)}` : undefined,
    stats: [
      { label: 'Total purchases', value: formatPKR(num(r.total_purchases)) },
      { label: 'Qty bought',      value: num(r.purchase_qty).toLocaleString() },
      { label: 'Orders',          value: String(num(r.order_count)) },
      { label: 'Paid',            value: formatPKR(num(r.total_paid)) },
      { label: 'Purchase returns',value: formatPKR(num(r.returns_value)) },
      balanceStat(bal, 'supplier'),
    ],
    summary: balanceSentence(s.name, bal, 'supplier'),
    suggestions: [`Ledger of ${s.name}`, 'Who do I owe'],
  }
}

async function partyLedger(ctx: Ctx, kind: 'customer' | 'supplier'): Promise<AskResponse> {
  const e = kind === 'customer' ? ctx.customer! : ctx.supplier!
  const fn = kind === 'customer' ? 'ask_customer_ledger' : 'ask_supplier_ledger'
  const idKey = kind === 'customer' ? 'p_customer_id' : 'p_supplier_id'
  const raw = await callRpc(ctx.admin, fn, { p_tenant_id: ctx.tenantId, [idKey]: e.id })
  if (!raw.length) return text(`No ledger movements found for ${e.name}.`)

  let bal = 0
  const all = raw.map((r) => {
    bal += kind === 'customer' ? num(r.debit) - num(r.credit) : num(r.credit) - num(r.debit)
    return {
      date: r.entry_date as string,
      voucher: (r.voucher as string) ?? '',
      description: (r.description as string) ?? '',
      debit: num(r.debit),
      credit: num(r.credit),
      balance: bal,
    }
  })
  const rows = all.slice(-100)
  const cols: AskColumn[] = [
    { key: 'date', label: 'Date', kind: 'date' },
    { key: 'voucher', label: 'Voucher' },
    { key: 'description', label: 'Description' },
    { key: 'debit', label: 'Debit', kind: 'money' },
    { key: 'credit', label: 'Credit', kind: 'money' },
    { key: 'balance', label: 'Balance', kind: 'money' },
  ]
  return {
    kind: 'table',
    title: `${e.name} — ledger`,
    subtitle: all.length > rows.length ? `Showing the latest ${rows.length} of ${all.length} entries` : `${all.length} entries`,
    columns: cols,
    rows,
    summary: balanceSentence(e.name, bal, kind),
    footer: `Closing balance: ${formatPKR(Math.abs(bal))} ${balanceSide(bal, kind)}`,
    suggestions: kind === 'customer' ? [`Business summary of ${e.name}`, 'Who owes me money'] : [`Business summary of ${e.name}`, 'Who do I owe'],
  }
}

async function itemLedger(ctx: Ctx): Promise<AskResponse> {
  const it = ctx.item!
  const raw = await callRpc(ctx.admin, 'ask_item_ledger', { p_tenant_id: ctx.tenantId, p_item_id: it.id })
  if (!raw.length) return text(`No stock movements found for ${it.name}.`)

  let bal = 0
  const all = raw.map((r) => {
    bal += num(r.qty_in) - num(r.qty_out)
    return {
      date: r.entry_date as string,
      kind: (r.kind as string) ?? '',
      reference: (r.reference as string) ?? '',
      qty_in: num(r.qty_in),
      qty_out: num(r.qty_out),
      balance: bal,
    }
  })
  const rows = all.slice(-100)
  return {
    kind: 'table',
    title: `${it.name} — stock ledger`,
    subtitle: all.length > rows.length ? `Showing the latest ${rows.length} of ${all.length} movements` : `${all.length} movements`,
    columns: [
      { key: 'date', label: 'Date', kind: 'date' },
      { key: 'kind', label: 'Type' },
      { key: 'reference', label: 'Ref' },
      { key: 'qty_in', label: 'In', kind: 'qty' },
      { key: 'qty_out', label: 'Out', kind: 'qty' },
      { key: 'balance', label: 'Balance', kind: 'qty' },
    ],
    rows,
    summary: `${it.name} currently nets to ${bal.toLocaleString()} on hand across ${all.length} movement${all.length !== 1 ? 's' : ''}.`,
    suggestions: ['Slow moving items', 'Low stock items'],
  }
}

async function slowItems(ctx: Ctx): Promise<AskResponse> {
  const days = parseDays(ctx.lowerQ, 90)
  const rows = (await callRpc(ctx.admin, 'ask_slow_items', { p_tenant_id: ctx.tenantId, p_days: days, p_limit: 15 })).map((r: Record<string, unknown>) => ({
    name: r.name as string,
    sold_qty: num(r.sold_qty),
    current_quantity: num(r.current_quantity),
    last_sold: (r.last_sold as string) ?? null,
  }))
  if (!rows.length) return text('No items found.')
  const zero = rows.filter((r: { sold_qty: number }) => r.sold_qty === 0).length
  return {
    kind: 'table',
    title: 'Slow-moving items',
    subtitle: `Least sold in the last ${days} days`,
    columns: [
      { key: 'name', label: 'Item' },
      { key: 'sold_qty', label: `Sold (${days}d)`, kind: 'qty' },
      { key: 'current_quantity', label: 'On hand', kind: 'qty' },
      { key: 'last_sold', label: 'Last sold', kind: 'date' },
    ],
    rows,
    summary: zero > 0
      ? `${zero} of these had no sales at all in the last ${days} days.`
      : `The ${rows.length} slowest movers over the last ${days} days.`,
    suggestions: ['Low stock items', 'Top customers'],
  }
}

async function slowCustomers(ctx: Ctx): Promise<AskResponse> {
  const days = parseDays(ctx.lowerQ, 90)
  const rows = (await callRpc(ctx.admin, 'ask_slow_customers', { p_tenant_id: ctx.tenantId, p_days: days, p_limit: 15 })).map((r: Record<string, unknown>) => ({
    name: r.name as string,
    recent_sales: num(r.recent_sales),
    last_order: (r.last_order as string) ?? null,
    balance: num(r.balance),
  }))
  if (!rows.length) return text('No customers found.')
  const zero = rows.filter((r: { recent_sales: number }) => r.recent_sales === 0).length
  return {
    kind: 'table',
    title: 'Slow / inactive customers',
    subtitle: `Least business in the last ${days} days`,
    columns: [
      { key: 'name', label: 'Customer' },
      { key: 'recent_sales', label: `Sales (${days}d)`, kind: 'money' },
      { key: 'last_order', label: 'Last order', kind: 'date' },
      { key: 'balance', label: 'Balance', kind: 'money' },
    ],
    rows,
    summary: zero > 0
      ? `${zero} customer${zero !== 1 ? 's' : ''} did no business in the last ${days} days.`
      : `The ${rows.length} least active customers over the last ${days} days.`,
    suggestions: ['Top customers', 'Who owes me money'],
  }
}

async function topCustomers(ctx: Ctx): Promise<AskResponse> {
  const days = parseDays(ctx.lowerQ, 365)
  const rows = (await callRpc(ctx.admin, 'ask_top_customers', { p_tenant_id: ctx.tenantId, p_days: days, p_limit: 10 })).map((r: Record<string, unknown>) => ({
    name: r.name as string,
    recent_sales: num(r.recent_sales),
    order_count: num(r.order_count),
    last_order: (r.last_order as string) ?? null,
  }))
  if (!rows.length) return text(`No sales found in the last ${days} days.`)
  return {
    kind: 'table',
    title: 'Top customers',
    subtitle: `By sales value in the last ${days} days`,
    columns: [
      { key: 'name', label: 'Customer' },
      { key: 'recent_sales', label: 'Sales', kind: 'money' },
      { key: 'order_count', label: 'Orders', kind: 'number' },
      { key: 'last_order', label: 'Last order', kind: 'date' },
    ],
    rows,
    summary: `${rows[0].name} leads with ${formatPKR(rows[0].recent_sales)} over the last ${days} days.`,
    suggestions: ['Slow / inactive customers', 'Who owes me money'],
  }
}

async function receivables(ctx: Ctx): Promise<AskResponse> {
  const rows = (await callRpc(ctx.admin, 'ask_receivables', { p_tenant_id: ctx.tenantId, p_limit: 20 })).map((r: Record<string, unknown>) => ({ name: r.name as string, balance: num(r.balance) }))
  if (!rows.length) return text('No customer currently owes you — all receivables are clear.')
  const total = rows.reduce((s: number, r: { balance: number }) => s + r.balance, 0)
  return {
    kind: 'table',
    title: 'Outstanding receivables',
    subtitle: 'Customers who owe you, largest first',
    columns: [{ key: 'name', label: 'Customer' }, { key: 'balance', label: 'Owes you', kind: 'money' }],
    rows,
    summary: `${rows.length} customer${rows.length !== 1 ? 's owe' : ' owes'} you ${formatPKR(total)} in total.`,
    footer: `Total receivable: ${formatPKR(total)}`,
    suggestions: ['Slow / inactive customers', 'Top customers'],
  }
}

async function payables(ctx: Ctx): Promise<AskResponse> {
  const rows = (await callRpc(ctx.admin, 'ask_payables', { p_tenant_id: ctx.tenantId, p_limit: 20 })).map((r: Record<string, unknown>) => ({ name: r.name as string, balance: num(r.balance) }))
  if (!rows.length) return text('You do not owe any supplier right now — all payables are clear.')
  const total = rows.reduce((s: number, r: { balance: number }) => s + r.balance, 0)
  return {
    kind: 'table',
    title: 'Outstanding payables',
    subtitle: 'Suppliers you owe, largest first',
    columns: [{ key: 'name', label: 'Supplier' }, { key: 'balance', label: 'You owe', kind: 'money' }],
    rows,
    summary: `You owe ${rows.length} supplier${rows.length !== 1 ? 's' : ''} ${formatPKR(total)} in total.`,
    footer: `Total payable: ${formatPKR(total)}`,
    suggestions: ['Who owes me money', 'Low stock items'],
  }
}

async function lowStock(ctx: Ctx): Promise<AskResponse> {
  const rows = (await callRpc(ctx.admin, 'ask_low_stock', { p_tenant_id: ctx.tenantId, p_limit: 20 })).map((r: Record<string, unknown>) => ({
    name: r.name as string,
    current_quantity: num(r.current_quantity),
    unit_of_measure: (r.unit_of_measure as string) ?? '',
  }))
  if (!rows.length) return text('No items found.')
  return {
    kind: 'table',
    title: 'Low stock items',
    subtitle: 'Least quantity on hand',
    columns: [
      { key: 'name', label: 'Item' },
      { key: 'current_quantity', label: 'On hand', kind: 'qty' },
      { key: 'unit_of_measure', label: 'Unit' },
    ],
    rows,
    summary: `${rows.filter((r: { current_quantity: number }) => r.current_quantity <= 0).length} item(s) are at or below zero on hand.`,
    suggestions: ['Slow moving items', 'Item ledger for '],
  }
}

const RUNNERS: Record<string, (ctx: Ctx) => Promise<AskResponse>> = {
  customer_summary: customerSummary,
  supplier_summary: supplierSummary,
  customer_ledger: (c) => partyLedger(c, 'customer'),
  supplier_ledger: (c) => partyLedger(c, 'supplier'),
  item_ledger: itemLedger,
  slow_items: slowItems,
  slow_customers: slowCustomers,
  top_customers: topCustomers,
  receivables: receivables,
  payables: payables,
  low_stock: lowStock,
}

// ── Classifier ──────────────────────────────────────────────────────
export async function runAsk(question: string): Promise<AskResponse> {
  const { tenantId } = await requireAuth()
  const q = (question ?? '').trim()
  if (!q) return help()
  const lowerQ = q.toLowerCase()
  const admin = createAdminClient()

  const [{ data: customers }, { data: suppliers }, { data: items }] = await Promise.all([
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId).limit(2000),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).limit(2000),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId).limit(2000),
  ])
  const customer = resolveEntity(lowerQ, (customers ?? []) as Entity[])
  const supplier = resolveEntity(lowerQ, (suppliers ?? []) as Entity[])
  const item = resolveEntity(lowerQ, (items ?? []) as Entity[])

  // Score each intent.
  const score = new Map<string, number>()
  const add = (id: string, n: number) => score.set(id, (score.get(id) ?? 0) + n)
  for (const [id, kws] of Object.entries(NONENTITY_KEYWORDS)) {
    for (const kw of kws) if (lowerQ.includes(kw)) add(id, 2)
  }

  const has = (...ws: string[]) => ws.some((w) => lowerQ.includes(w))
  const ledgerWord = has('ledger', 'statement', 'account', 'khata', 'movement', 'history')
  const bizWord = has('business', 'summary', 'overview', 'dealing', 'profile')

  // Entity + intent-word routing. An entity of a given type strongly implies
  // its ledger/summary; a bare name defaults to the business overview.
  if (item && has('ledger', 'movement', 'stock', 'item', 'history')) add('item_ledger', 5)
  if (supplier && ledgerWord) add('supplier_ledger', 4)
  if (supplier && bizWord) add('supplier_summary', 4)
  if (customer && ledgerWord) add('customer_ledger', 4)
  if (customer && bizWord) add('customer_summary', 4)
  if (customer && !ledgerWord && !bizWord) add('customer_summary', 2)
  else if (supplier && !ledgerWord && !bizWord) add('supplier_summary', 2)
  else if (item && !ledgerWord && !bizWord) add('item_ledger', 2)

  let bestId: string | null = null
  let bestScore = 0
  for (const [id, s] of score) {
    if (s > bestScore) { bestScore = s; bestId = id }
  }

  if (!bestId || bestScore === 0) {
    // Nothing matched — but if they clearly wanted a ledger/summary without a
    // recognizable name, say so rather than guessing.
    if (ledgerWord || bizWord) {
      return text(
        "I couldn't match that to a customer, supplier, or item on file. Try including the exact name, e.g. \"ledger of Ali Traders\".",
        ASK_EXAMPLES,
      )
    }
    return help()
  }

  const ctx: Ctx = { admin, tenantId, question: q, lowerQ, customer, supplier, item }
  return RUNNERS[bestId](ctx)
}

// ── Formatting helpers ──────────────────────────────────────────────
function fmtDate(v: unknown): string {
  if (!v) return '—'
  const s = String(v).slice(0, 10)
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`
}

// For a customer, a debit balance means they owe us; for a supplier, a credit
// balance means we owe them. `balance` is already signed to the party's normal
// side, so positive = the party is in our debt.
function balanceSide(bal: number, kind: 'customer' | 'supplier'): string {
  if (Math.abs(bal) < 0.01) return '(settled)'
  if (kind === 'customer') return bal > 0 ? '(owes you)' : '(in credit / advance)'
  return bal > 0 ? '(you owe)' : '(advance paid)'
}

function balanceStat(bal: number, kind: 'customer' | 'supplier') {
  const tone = Math.abs(bal) < 0.01 ? 'default' : (kind === 'customer' ? (bal > 0 ? 'negative' : 'positive') : (bal > 0 ? 'negative' : 'positive'))
  return { label: 'Balance', value: `${formatPKR(Math.abs(bal))} ${balanceSide(bal, kind)}`, tone: tone as 'default' | 'positive' | 'negative' }
}

function balanceSentence(name: string, bal: number, kind: 'customer' | 'supplier'): string {
  if (Math.abs(bal) < 0.01) return `${name} is fully settled.`
  const amt = formatPKR(Math.abs(bal))
  if (kind === 'customer') return bal > 0 ? `${name} owes you ${amt}.` : `${name} is in credit by ${amt}.`
  return bal > 0 ? `You owe ${name} ${amt}.` : `${name} holds an advance of ${amt}.`
}

function text(body: string, suggestions?: string[]): AskResponse {
  return { kind: 'text', body, suggestions }
}

function help(): AskResponse {
  return {
    kind: 'text',
    title: 'Ask about your business',
    body: 'Type a question about your own data — ledgers, balances, and activity. I only report what is already recorded, nothing is estimated. Try one of these:',
    suggestions: ASK_EXAMPLES,
  }
}

function followups(_name: string): string[] {
  return ASK_EXAMPLES
}
