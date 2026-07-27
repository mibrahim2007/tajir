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
import { ASK_EXAMPLES, ASK_HOWTO_EXAMPLES, ASK_NEWCOMER_EXAMPLES } from '@/lib/ask/types'
import { GUIDES, GUIDE_INDEX_KEYWORDS, matchGuide, type Guide } from '@/lib/ask/guides'
import { FAQ_INDEX_KEYWORDS, matchFaq, faqsByCategory, isComparativeQuestion, type Faq } from '@/lib/ask/faq'

type Entity = { id: string; name: string }

// Structural / intent words that are never part of a party or item name, so a
// partial-name match never latches onto them (e.g. "top customers" must not
// resolve a customer literally called "Top Store").
const NAME_STOPWORDS = new Set([
  'ledger', 'statement', 'account', 'accounts', 'khata', 'movement', 'movements', 'history',
  'balance', 'balances', 'summary', 'overview', 'dealing', 'dealings', 'profile', 'business',
  'show', 'give', 'tell', 'get', 'find', 'list', 'the', 'and', 'for', 'from', 'with', 'all',
  'what', 'whats', 'which', 'who', 'whom', 'how', 'much', 'many', 'are', 'is', 'do', 'does',
  'my', 'me', 'our', 'total', 'report', 'detail', 'details', 'about', 'any', 'due', 'past',
  'customer', 'customers', 'supplier', 'suppliers', 'party', 'item', 'items', 'stock', 'inventory',
  'sale', 'sales', 'purchase', 'purchases', 'receivable', 'receivables', 'payable', 'payables',
  'payment', 'payments', 'receipt', 'receipts', 'cheque', 'cheques', 'pdc', 'overdue', 'money',
  'owe', 'owes', 'top', 'low', 'slow', 'best', 'pending', 'bounced', 'cleared', 'value', 'worth',
])

const tokenize = (s: string): string[] => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

// ── Entity resolution ───────────────────────────────────────────────
// Find the customer/supplier/item named in the question. Matching is
// case-insensitive and works like SQL ILIKE '%…%': it first tries the full name
// as a substring of the question (longest wins), then falls back to a partial
// match — any distinctive word in the question that appears inside a name (or
// vice-versa) — so "star" finds "Star Technologies Pvt Ltd" and "ali traders"
// finds "Ali Traders & Co".
function resolveEntity(lowerQ: string, list: Entity[]): Entity | null {
  // Pass 1 — the whole name appears in the question (most reliable).
  let best: Entity | null = null
  for (const e of list) {
    const n = (e.name ?? '').trim().toLowerCase()
    if (n.length < 2) continue
    if (lowerQ.includes(n) && (!best || n.length > (best.name ?? '').length)) best = e
  }
  if (best) return best

  // Pass 2 — partial (ILIKE-style). Score each name by how much of the
  // question's non-stopword content it shares, in either direction.
  const qTokens = tokenize(lowerQ).filter((t) => t.length >= 3 && !NAME_STOPWORDS.has(t))
  if (!qTokens.length) return null

  let bestScore = 0
  for (const e of list) {
    const nameLower = (e.name ?? '').toLowerCase()
    if (nameLower.length < 2) continue
    const nameTokens = tokenize(nameLower).filter((t) => t.length >= 2)
    let score = 0
    for (const qt of qTokens) {
      if (nameLower.includes(qt)) score += qt.length                      // question word inside the name
      else if (nameTokens.some((nt) => nt.length >= 3 && qt.includes(nt))) score += 2  // name word inside the question word
    }
    if (score > bestScore) { bestScore = score; best = e }
  }
  // Require a reasonably distinctive overlap (≥3 matched chars) so a single
  // short/common fragment can't pull in an unrelated party.
  return bestScore >= 3 ? best : null
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
  cheques:        ['cheque', 'cheques', 'pdc', 'post dated', 'post-dated', 'dated cheque'],
  stock_summary:  ['stock summary', 'inventory summary', 'stock value', 'inventory value', 'stock overview', 'inventory overview', 'total stock', 'stock worth', 'value of stock', 'stock on hand', 'inventory on hand', 'stock report', 'how much stock'],
  overdue:        ['overdue', 'past due', 'past-due', 'overdue invoice', 'overdue receivable', 'overdue payable', 'overdue receipt', 'overdue payment', 'due invoices', 'late payment', 'late invoice', 'payments overdue', 'receipts overdue', 'what is overdue', 'whats overdue'],
}

// Higher-weight phrases so a specific cheque intent beats the generic list
// (which also matches the bare word "cheque").
const SPECIFIC_KEYWORDS: Record<string, string[]> = {
  cheque_summary: ['cheque summary', 'cheques summary', 'pdc summary', 'cheque overview', 'how many cheque', 'cheque total', 'cheques total'],
  cheque_lookup:  ['cheque no', 'cheque number', 'cheque #', 'cheque#', 'status of cheque', 'find cheque', 'trace cheque', 'which cheque'],
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
  if (!r) return text(`No activity found for ${c.name} yet.`, ASK_EXAMPLES)
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

// A name fragment lists everything it matches, anywhere in the tenant's
// records — customers, suppliers, stock items (by name, code or SKU) and
// employees — the way an ILIKE '%term%' search is expected to behave.
//
// This used to search parties only, so a fragment like "card" found nothing to
// disambiguate, fell through to fuzzy matching, and silently returned ONE
// item's ledger while the others stayed invisible.
const TYPE_LABEL: Record<string, string> = {
  customer: 'Customer', supplier: 'Supplier', item: 'Item', employee: 'Employee',
}

function searchStatus(kind: string, value: number | null): string {
  if (kind === 'item') return value === null ? '—' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} on hand`
  if (kind === 'employee') return '—'
  if (value === null || Math.abs(value) < 0.01) return 'Settled'
  if (kind === 'customer') return value > 0 ? `Owes you ${formatPKR(value)}` : `In credit ${formatPKR(-value)}`
  return value > 0 ? `You owe ${formatPKR(value)}` : `Advance paid ${formatPKR(-value)}`
}

/** The follow-up that makes sense for each kind of match. */
function searchFollowUp(kind: string, name: string): string | null {
  if (kind === 'item') return `Item ledger for ${name}`
  if (kind === 'customer' || kind === 'supplier') return `Ledger of ${name}`
  return null
}

async function universalSearch(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  term: string,
): Promise<AskResponse> {
  const raw = await callRpc(admin, 'ask_search_all', { p_tenant_id: tenantId, p_term: term })
  if (!raw.length) {
    return text(`Nothing in your records matches "${term}" — no customer, supplier, item or employee.`, ASK_EXAMPLES)
  }

  const rows = raw.map((r) => {
    const kind = (r.kind as string) ?? ''
    const value = r.value === null || r.value === undefined ? null : num(r.value)
    return {
      name: (r.name as string) ?? '—',
      type: TYPE_LABEL[kind] ?? kind,
      detail: (r.detail as string) || '',
      status: searchStatus(kind, value),
      _kind: kind,
    }
  })

  // "3 items, 2 customers" reads better than a bare total.
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.type, (counts.get(r.type) ?? 0) + 1)
  const breakdown = [...counts.entries()]
    .map(([t, n]) => `${n} ${t.toLowerCase()}${n !== 1 ? 's' : ''}`)
    .join(', ')

  return {
    kind: 'table',
    title: `Matches for "${term}"`,
    subtitle: raw.length >= 60 ? 'Showing the first 60 matches' : 'Tap one below to open it',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type' },
      { key: 'detail', label: 'Code' },
      { key: 'status', label: 'Balance / Stock' },
    ],
    // _kind drives the follow-ups below; it is not a column.
    rows: rows.map((r) => ({ name: r.name, type: r.type, detail: r.detail, status: r.status })),
    summary: `${breakdown} match “${term}”.`,
    suggestions: rows
      .map((r) => searchFollowUp(r._kind, r.name))
      .filter((s): s is string => s !== null)
      .slice(0, 6),
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

async function stockSummary(ctx: Ctx): Promise<AskResponse> {
  const r = (await callRpc(ctx.admin, 'ask_stock_summary', { p_tenant_id: ctx.tenantId }))[0] as Record<string, unknown> | undefined
  if (!r || num(r.total_items) === 0) return text('No items in inventory yet.', ['Low stock items', 'Slow moving items'])
  const value = num(r.total_value)
  const units = num(r.total_units)
  const inv = num(r.inventory_items)
  const out = num(r.out_of_stock)
  const low = num(r.low_stock)
  const svc = num(r.service_items)
  const fmtUnits = units.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return {
    kind: 'stats',
    title: 'Stock summary',
    subtitle: 'Inventory on hand and its approximate value',
    stats: [
      { label: 'Items', value: String(num(r.total_items)) },
      { label: 'Stock value', value: formatPKR(value) },
      { label: 'Units on hand', value: fmtUnits },
      { label: 'Out of stock', value: String(out), tone: out > 0 ? 'negative' : 'default' },
      { label: 'Low (≤5)', value: String(low), tone: low > 0 ? 'negative' : 'default' },
      ...(svc > 0 ? [{ label: 'Service items', value: String(svc) }] : []),
    ],
    // Value uses each item's latest purchase rate (opening rate as fallback), so
    // it's an estimate, not a booked figure.
    summary: `${inv} stockable item${inv !== 1 ? 's' : ''} holding ${fmtUnits} units, worth about ${formatPKR(value)}.${out > 0 ? ` ${out} out of stock.` : ''}${low > 0 ? ` ${low} running low.` : ''}`,
    suggestions: ['Low stock items', 'Slow moving items', 'What is overdue'],
  }
}

async function overdue(ctx: Ctx): Promise<AskResponse> {
  const raw = await callRpc(ctx.admin, 'ask_overdue', { p_tenant_id: ctx.tenantId, p_limit: 40 })
  if (!raw.length) return text('Nothing is overdue — no invoices past their payment due date and no post-dated cheques past due.', ['Who owes me money', 'Cheque summary'])
  const rows = raw.map((r) => ({
    side: (r.side as string) === 'receivable' ? 'To collect' : 'To pay',
    party: (r.party_name as string) || '—',
    type: cap(r.kind as string),
    detail: (r.reference as string) || '',
    due: (r.due_date as string) ?? null,
    amount: num(r.amount),
  }))
  const collect = rows.filter((x) => x.side === 'To collect').reduce((s, x) => s + x.amount, 0)
  const pay = rows.filter((x) => x.side === 'To pay').reduce((s, x) => s + x.amount, 0)
  const net = collect - pay
  return {
    kind: 'table',
    title: 'Overdue — past due date',
    subtitle: 'Invoices past their payment due date and post-dated cheques past due',
    columns: [
      { key: 'side', label: 'Direction' },
      { key: 'party', label: 'Party' },
      { key: 'type', label: 'Type' },
      { key: 'detail', label: 'Detail' },
      { key: 'due', label: 'Due', kind: 'date' },
      { key: 'amount', label: 'Amount', kind: 'money' },
    ],
    rows,
    summary: `${formatPKR(collect)} overdue to collect · ${formatPKR(pay)} overdue to pay.`,
    footer: `Net overdue: ${formatPKR(Math.abs(net))} ${net >= 0 ? 'in your favour' : 'against you'}`,
    suggestions: ['Overdue cheques', 'Who owes me money', 'Who do I owe'],
  }
}

// ── Cheques (post-dated cheque register) ────────────────────────────
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const dirLabel = (d: string) => (d === 'in' ? 'Received' : 'Issued')

// Read the status / direction / overdue filters out of the wording.
function chequeFilters(lowerQ: string): { status: string | null; direction: string | null; overdue: boolean } {
  let status: string | null = null
  if (lowerQ.includes('bounce')) status = 'bounced'
  else if (lowerQ.includes('cleared') || lowerQ.includes('clear ')) status = 'cleared'
  else if (lowerQ.includes('endorse')) status = 'endorsed'
  else if (lowerQ.includes('pending') || lowerQ.includes('outstanding') || lowerQ.includes('in hand')) status = 'pending'

  let overdue = false
  if (lowerQ.includes('overdue') || lowerQ.includes('late') || lowerQ.includes('past due')) { overdue = true; status = 'pending' }

  let direction: string | null = null
  if (lowerQ.includes('received') || lowerQ.includes('incoming') || lowerQ.includes('from customer') || lowerQ.includes('customer cheque') || lowerQ.includes('in hand')) direction = 'in'
  else if (lowerQ.includes('issued') || lowerQ.includes('outgoing') || lowerQ.includes('to supplier') || lowerQ.includes('supplier cheque') || lowerQ.includes('we gave') || lowerQ.includes('we issued')) direction = 'out'

  return { status, direction, overdue }
}

function chequeRows(raw: Record<string, unknown>[]) {
  return raw.map((r) => ({
    cheque: (r.cheque_number as string) || '—',
    party: (r.party_name as string) || '—',
    type: dirLabel(r.direction as string),
    due: (r.cheque_due_date as string) ?? null,
    amount: num(r.amount),
    status: cap(r.pdc_status as string),
  }))
}

const CHEQUE_COLS: AskColumn[] = [
  { key: 'cheque', label: 'Cheque #' },
  { key: 'party', label: 'Party' },
  { key: 'type', label: 'Type' },
  { key: 'due', label: 'Due', kind: 'date' },
  { key: 'amount', label: 'Amount', kind: 'money' },
  { key: 'status', label: 'Status' },
]

async function chequesList(ctx: Ctx): Promise<AskResponse> {
  const f = chequeFilters(ctx.lowerQ)
  const raw = await callRpc(ctx.admin, 'ask_cheques', {
    p_tenant_id: ctx.tenantId, p_status: f.status, p_direction: f.direction, p_overdue: f.overdue, p_limit: 40,
  })
  const rows = chequeRows(raw)
  if (!rows.length) return text('No cheques match that. Try "pending cheques", "bounced cheques", or "cheque summary".', ['Cheque summary', 'Pending cheques'])

  const parts = [
    f.overdue ? 'overdue' : '',
    f.status && !f.overdue ? f.status : '',
    f.direction ? dirLabel(f.direction).toLowerCase() : '',
  ].filter(Boolean)
  const label = parts.length ? parts.join(' ') + ' cheques' : 'cheques'
  const total = rows.reduce((s, r) => s + r.amount, 0)
  return {
    kind: 'table',
    title: `Cheques — ${label}`,
    subtitle: raw.length >= 40 ? 'Showing the first 40' : `${rows.length} cheque${rows.length !== 1 ? 's' : ''}`,
    columns: CHEQUE_COLS,
    rows,
    summary: `${rows.length} ${label} worth ${formatPKR(total)} in total.`,
    footer: `Total: ${formatPKR(total)}`,
    suggestions: ['Cheque summary', 'Bounced cheques', 'Overdue cheques'],
  }
}

async function chequeSummary(ctx: Ctx): Promise<AskResponse> {
  const raw = await callRpc(ctx.admin, 'ask_cheque_summary', { p_tenant_id: ctx.tenantId })
  if (!raw.length) return text('No cheques recorded yet.')
  const rows = raw.map((r) => ({
    type: dirLabel(r.direction as string),
    status: cap(r.pdc_status as string),
    count: num(r.n),
    total: num(r.total),
  }))
  const pendIn = rows.filter((r) => r.type === 'Received' && r.status === 'Pending').reduce((s, r) => s + r.total, 0)
  const pendOut = rows.filter((r) => r.type === 'Issued' && r.status === 'Pending').reduce((s, r) => s + r.total, 0)
  return {
    kind: 'table',
    title: 'Cheque summary',
    subtitle: 'Counts and value by type and status',
    columns: [
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'count', label: 'Count', kind: 'number' },
      { key: 'total', label: 'Value', kind: 'money' },
    ],
    rows,
    summary: `Pending in hand ${formatPKR(pendIn)} to collect · ${formatPKR(pendOut)} you have issued.`,
    suggestions: ['Pending cheques', 'Bounced cheques', 'Overdue cheques'],
  }
}

function chequeNumberFromQuestion(q: string): string | null {
  const m = q.match(/([0-9][0-9a-zA-Z\-/]{2,})/)
  return m ? m[1] : null
}

async function chequeLookup(ctx: Ctx): Promise<AskResponse> {
  const numToken = chequeNumberFromQuestion(ctx.question)
  if (!numToken) return chequesList(ctx)   // no number given → fall back to a list
  const raw = await callRpc(ctx.admin, 'ask_cheque_by_number', { p_tenant_id: ctx.tenantId, p_number: numToken })
  const rows = chequeRows(raw)
  if (!rows.length) return text(`No cheque matching "${numToken}" was found.`, ['Pending cheques', 'Cheque summary'])
  return {
    kind: 'table',
    title: `Cheque ${numToken}`,
    subtitle: rows.length > 1 ? `${rows.length} matches` : undefined,
    columns: CHEQUE_COLS,
    rows,
    summary: rows.length === 1
      ? `Cheque ${rows[0].cheque} (${dirLabel(raw[0].direction as string).toLowerCase()}, ${rows[0].party}) is ${rows[0].status.toLowerCase()}.`
      : `${rows.length} cheques match "${numToken}".`,
    suggestions: ['Pending cheques', 'Cheque summary'],
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
  stock_summary: stockSummary,
  overdue: overdue,
  cheques: chequesList,
  cheque_summary: chequeSummary,
  cheque_lookup: chequeLookup,
}

// ── Classifier ──────────────────────────────────────────────────────
export async function runAsk(question: string): Promise<AskResponse> {
  const { tenantId } = await requireAuth()
  const q = (question ?? '').trim()
  if (!q) return help()
  const lowerQ = q.toLowerCase()
  const admin = createAdminClient()

  // How-to / concept questions are answered before anything touches the data.
  // They have to come first: "how to create a sale invoice" contains words that
  // would otherwise partial-match a party or item name and get routed to a
  // ledger. matchGuide() only fires on an explicit how-to cue or a phrase that
  // can only be a question about the software, so data queries are unaffected.
  if (GUIDE_INDEX_KEYWORDS.some((k) => lowerQ.includes(k))) return guideIndex()
  if (FAQ_INDEX_KEYWORDS.some((k) => lowerQ.includes(k))) return faqIndex()
  // "Difference between a sale return and a credit note" names a topic the
  // guides cover, but it is asking which to use — not for the steps of the one
  // it happened to name first. Comparative wording goes to the FAQ.
  if (isComparativeQuestion(lowerQ)) {
    const compared = matchFaq(lowerQ)
    if (compared) return faqResponse(compared)
  }
  const guide = matchGuide(lowerQ)
  if (guide) return guideResponse(guide)
  // Otherwise FAQs run after the how-to guides: "how to create a sale invoice"
  // should get the steps, not the concept.
  const faq = matchFaq(lowerQ)
  if (faq) return faqResponse(faq)

  const [{ data: customers }, { data: suppliers }, { data: items }] = await Promise.all([
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId).limit(2000),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).limit(2000),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId).limit(2000),
  ])
  const custList = (customers ?? []) as Entity[]
  const supList = (suppliers ?? []) as Entity[]

  const itemList = (items ?? []) as Entity[]
  const searchable = [...custList, ...supList, ...itemList]

  // "search card", "find ali" — an explicit request always lists, however many
  // things match, so there is a reliable way to see everything.
  const explicit = lowerQ.match(/^(?:search|find|look\s*(?:for|up)|show\s+all|list\s+all|talash)\s+(?:for\s+)?(.{2,40})$/)
  if (explicit) return universalSearch(admin, tenantId, explicit[1].trim())

  // Disambiguation: a fragment matching several records lists them all, rather
  // than the engine silently picking one. Skipped when the query already
  // contains a full name (then the user has named a specific one). The search
  // term is the question's most-matching non-stopword word.
  //
  // Items are included here — when they were not, "card" matched no party, fell
  // through to fuzzy matching and returned ONE item's ledger with no sign that
  // other items also matched.
  const hasExactName = searchable.some((e) => {
    const n = (e.name ?? '').trim().toLowerCase()
    return n.length >= 2 && lowerQ.includes(n)
  })
  if (!hasExactName) {
    let term = ''
    let termHits = 0
    for (const t of tokenize(lowerQ).filter((t) => t.length >= 3 && !NAME_STOPWORDS.has(t))) {
      const hits = searchable.filter((e) => (e.name ?? '').toLowerCase().includes(t)).length
      if (hits > termHits) { termHits = hits; term = t }
    }
    if (term && termHits >= 2) return universalSearch(admin, tenantId, term)
  }

  const customer = resolveEntity(lowerQ, custList)
  const supplier = resolveEntity(lowerQ, supList)
  const item = resolveEntity(lowerQ, itemList)

  // Score each intent.
  const score = new Map<string, number>()
  const add = (id: string, n: number) => score.set(id, (score.get(id) ?? 0) + n)
  for (const [id, kws] of Object.entries(NONENTITY_KEYWORDS)) {
    for (const kw of kws) if (lowerQ.includes(kw)) add(id, 2)
  }
  // Specific cheque intents outweigh the generic list, which also matches the
  // bare word "cheque".
  for (const [id, kws] of Object.entries(SPECIFIC_KEYWORDS)) {
    for (const kw of kws) if (lowerQ.includes(kw)) add(id, 3)
  }

  const has = (...ws: string[]) => ws.some((w) => lowerQ.includes(w))
  const ledgerWord = has('ledger', 'statement', 'account', 'khata', 'movement', 'history')
  const bizWord = has('business', 'summary', 'overview', 'dealing', 'profile')

  // "overdue cheques" is already served by the cheque intent (it supports an
  // overdue filter); only use the combined overdue view when not cheque-specific.
  if (has('cheque', 'cheques', 'pdc', 'post dated', 'post-dated')) score.delete('overdue')

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

// ── How-to answers ──────────────────────────────────────────────────
function guideResponse(g: Guide): AskResponse {
  return {
    kind: 'guide',
    title: g.title,
    subtitle: g.subtitle,
    intro: g.intro,
    steps: g.steps,
    notes: g.notes,
    links: g.links,
    suggestions: g.related ?? ASK_HOWTO_EXAMPLES.slice(0, 3),
  }
}

function guideIndex(): AskResponse {
  return {
    kind: 'text',
    title: 'What I can walk you through',
    body: GUIDES.map((g) => `• ${g.title}`).join('\n')
      + '\n\nTap one below, or ask about your own data — ledgers, balances, stock and cheques.',
    suggestions: ASK_HOWTO_EXAMPLES,
  }
}

function faqResponse(f: Faq): AskResponse {
  return {
    kind: 'faq',
    title: f.question,
    category: f.category,
    answer: f.answer,
    points: f.points,
    links: f.links,
    suggestions: f.related ?? ASK_NEWCOMER_EXAMPLES.slice(0, 3),
  }
}

function faqIndex(): AskResponse {
  return {
    kind: 'topics',
    title: 'Common questions',
    subtitle: 'Tap any question for a plain-language answer',
    groups: faqsByCategory(),
    suggestions: ['I am new — where do I start?', 'What can I ask about my data?'],
  }
}

function help(): AskResponse {
  return {
    kind: 'text',
    title: 'Ask about your business',
    body: 'Type a question about your own data — ledgers, balances, and activity — or ask how to do something ("how to create a sale invoice"), or what something means ("what is an opening balance"). I only report what is already recorded, nothing is estimated. Try one of these:',
    suggestions: [...ASK_EXAMPLES.slice(0, 6), ...ASK_HOWTO_EXAMPLES.slice(0, 3), ...ASK_NEWCOMER_EXAMPLES.slice(0, 3)],
  }
}

