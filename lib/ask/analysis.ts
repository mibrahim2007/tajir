// Ask's analysis answers: trading over time, where the money goes, and which
// parties matter most.
//
// Kept out of engine.ts because that file is already the classifier plus every
// ledger runner. Same contract as the rest of Ask: one read-only tenant-scoped
// SQL function per question (migration 0057), nothing inferred, no model.

import type { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import type { AskResponse, AskColumn } from '@/lib/ask/types'

type Admin = ReturnType<typeof createAdminClient>

const num = (v: unknown) => Number(v ?? 0)
const qty = (v: unknown) => num(v).toLocaleString(undefined, { maximumFractionDigits: 2 })

/** How many months of history the comparisons cover. */
export const ANALYSIS_MONTHS = 12

async function rpc(admin: Admin, fn: string, args: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return (data ?? []) as Record<string, unknown>[]
}

function empty(title: string, body: string): AskResponse {
  return { kind: 'text', title, body, suggestions: ['Stock summary', 'Who owes me money'] }
}

/** "2026-07" → "Jul 2026". Month keys are sortable; labels are readable. */
function monthLabel(key: string): string {
  const [y, m] = (key ?? '').split('-')
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const i = Number(m) - 1
  return names[i] ? `${names[i]} ${y}` : key
}

/** Movement between the two most recent months, phrased for a summary line. */
function trend(rows: { value: number }[], noun: string): string {
  if (rows.length < 2) return ''
  const last = rows[rows.length - 1].value
  const prev = rows[rows.length - 2].value
  if (prev === 0) return last > 0 ? ` ${noun} started this month.` : ''
  const pct = ((last - prev) / Math.abs(prev)) * 100
  const dir = pct >= 0 ? 'up' : 'down'
  return ` Latest month is ${dir} ${Math.abs(pct).toFixed(1)}% on the one before.`
}

const MONTH_COLS: AskColumn[] = [
  { key: 'month',  label: 'Month' },
  { key: 'orders', label: 'Orders', kind: 'number' },
  { key: 'qty',    label: 'Quantity', kind: 'qty' },
  { key: 'value',  label: 'Value (PKR)', kind: 'money' },
]

/** Monthly sales, newest month last so the shape reads left to right. */
export async function monthlySales(admin: Admin, tenantId: string): Promise<AskResponse> {
  const raw = await rpc(admin, 'ask_monthly_sales', { p_tenant_id: tenantId, p_months: ANALYSIS_MONTHS })
  if (raw.length === 0) return empty('Monthly sales', 'No sales recorded in the last 12 months.')

  const rows = raw.map((r) => ({ month: monthLabel(String(r.month)), orders: num(r.orders), qty: num(r.qty), value: num(r.value) }))
  const total = rows.reduce((s, r) => s + r.value, 0)
  const best = rows.reduce((b, r) => (r.value > b.value ? r : b), rows[0])

  return {
    kind: 'table',
    title: 'Monthly sales',
    subtitle: `Last ${rows.length} month${rows.length === 1 ? '' : 's'}`,
    columns: MONTH_COLS,
    rows,
    summary: `${formatPKR(total)} across ${rows.length} month${rows.length === 1 ? '' : 's'}. Best month was ${best.month} at ${formatPKR(best.value)}.${trend(rows, 'Sales')}`,
    footer: `Total ${formatPKR(total)}`,
    suggestions: ['Monthly purchase comparison', 'Customer grading', 'Expense summary'],
  }
}

export async function monthlyPurchases(admin: Admin, tenantId: string): Promise<AskResponse> {
  const raw = await rpc(admin, 'ask_monthly_purchases', { p_tenant_id: tenantId, p_months: ANALYSIS_MONTHS })
  if (raw.length === 0) return empty('Monthly purchases', 'No purchases recorded in the last 12 months.')

  const rows = raw.map((r) => ({ month: monthLabel(String(r.month)), orders: num(r.orders), qty: num(r.qty), value: num(r.value) }))
  const total = rows.reduce((s, r) => s + r.value, 0)
  const best = rows.reduce((b, r) => (r.value > b.value ? r : b), rows[0])

  return {
    kind: 'table',
    title: 'Monthly purchases',
    subtitle: `Last ${rows.length} month${rows.length === 1 ? '' : 's'}`,
    columns: MONTH_COLS,
    rows,
    summary: `${formatPKR(total)} across ${rows.length} month${rows.length === 1 ? '' : 's'}. Heaviest month was ${best.month} at ${formatPKR(best.value)}.${trend(rows, 'Purchasing')}`,
    footer: `Total ${formatPKR(total)}`,
    suggestions: ['Monthly sale comparison', 'Supplier grading', 'Expense summary'],
  }
}

/** Sales and purchases side by side — the question behind "how is trade going". */
export async function tradeComparison(admin: Admin, tenantId: string): Promise<AskResponse> {
  const [sales, purch] = await Promise.all([
    rpc(admin, 'ask_monthly_sales', { p_tenant_id: tenantId, p_months: ANALYSIS_MONTHS }),
    rpc(admin, 'ask_monthly_purchases', { p_tenant_id: tenantId, p_months: ANALYSIS_MONTHS }),
  ])
  if (sales.length === 0 && purch.length === 0) {
    return empty('Sales vs purchases', 'No sales or purchases recorded in the last 12 months.')
  }

  const byMonth = new Map<string, { sold: number; bought: number }>()
  for (const r of sales)  byMonth.set(String(r.month), { sold: num(r.value), bought: 0 })
  for (const r of purch) {
    const k = String(r.month)
    byMonth.set(k, { sold: byMonth.get(k)?.sold ?? 0, bought: num(r.value) })
  }

  const rows = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month: monthLabel(month),
      sold: v.sold,
      bought: v.bought,
      // Not profit: purchases are stock bought, not stock sold. It is the cash
      // shape of the month's trading, which is what the question is really about.
      gap: v.sold - v.bought,
    }))

  const soldTotal = rows.reduce((s, r) => s + r.sold, 0)
  const boughtTotal = rows.reduce((s, r) => s + r.bought, 0)

  return {
    kind: 'table',
    title: 'Sales vs purchases',
    subtitle: `Last ${rows.length} month${rows.length === 1 ? '' : 's'}`,
    columns: [
      { key: 'month',  label: 'Month' },
      { key: 'sold',   label: 'Sales (PKR)', kind: 'money' },
      { key: 'bought', label: 'Purchases (PKR)', kind: 'money' },
      { key: 'gap',    label: 'Difference', kind: 'money' },
    ],
    rows,
    summary: `Sold ${formatPKR(soldTotal)}, bought ${formatPKR(boughtTotal)} — a difference of ${formatPKR(soldTotal - boughtTotal)}. This compares money in against stock bought; it is not profit, which also depends on what was sold from stock.`,
    footer: `Sales ${formatPKR(soldTotal)} · Purchases ${formatPKR(boughtTotal)}`,
    suggestions: ['Monthly sale comparison', 'Expense summary', 'Customer grading'],
  }
}

/** Where the money goes: expense accounts, biggest first. */
export async function expenseSummary(admin: Admin, tenantId: string): Promise<AskResponse> {
  const [breakdown, monthly] = await Promise.all([
    rpc(admin, 'ask_expense_breakdown', { p_tenant_id: tenantId, p_months: ANALYSIS_MONTHS }),
    rpc(admin, 'ask_monthly_expenses', { p_tenant_id: tenantId, p_months: ANALYSIS_MONTHS }),
  ])
  if (breakdown.length === 0) return empty('Expenses', 'No expenses recorded in the last 12 months.')

  const total = breakdown.reduce((s, r) => s + num(r.total), 0)
  const rows = breakdown.map((r) => ({
    account: String(r.account),
    code: String(r.code ?? ''),
    total: num(r.total),
    share: total > 0 ? Number(((num(r.total) / total) * 100).toFixed(1)) : 0,
  }))

  const latest = monthly.length > 0 ? monthly[monthly.length - 1] : null
  const top = rows[0]

  return {
    kind: 'table',
    title: 'Expenses',
    subtitle: `By account, last ${ANALYSIS_MONTHS} months`,
    columns: [
      { key: 'code',    label: 'Code' },
      { key: 'account', label: 'Account' },
      { key: 'total',   label: 'Total (PKR)', kind: 'money' },
      { key: 'share',   label: 'Share %', kind: 'number' },
    ],
    rows,
    summary: `${formatPKR(total)} across ${rows.length} expense account${rows.length === 1 ? '' : 's'}. Largest is ${top.account} at ${formatPKR(top.total)} (${top.share}%).${latest ? ` ${monthLabel(String(latest.month))}: ${formatPKR(num(latest.total))}.` : ''}`,
    footer: `Total ${formatPKR(total)}`,
    suggestions: ['Monthly sale comparison', 'Sales vs purchases', 'Customer grading'],
  }
}

/** One item's sales and purchases, month by month. */
export async function itemMonthly(admin: Admin, tenantId: string, itemId: string, itemName: string): Promise<AskResponse> {
  const raw = await rpc(admin, 'ask_item_monthly', { p_tenant_id: tenantId, p_item_id: itemId, p_months: ANALYSIS_MONTHS })

  const rows = raw.map((r) => ({
    month: monthLabel(String(r.month)),
    sold_qty: num(r.sold_qty),
    sold_value: num(r.sold_value),
    bought_qty: num(r.bought_qty),
    bought_value: num(r.bought_value),
  }))

  const soldQty = rows.reduce((s, r) => s + r.sold_qty, 0)
  const boughtQty = rows.reduce((s, r) => s + r.bought_qty, 0)
  if (soldQty === 0 && boughtQty === 0) {
    return empty(`${itemName} — month by month`, `No sales or purchases recorded for ${itemName} in the last ${ANALYSIS_MONTHS} months.`)
  }

  const soldValue = rows.reduce((s, r) => s + r.sold_value, 0)
  const boughtValue = rows.reduce((s, r) => s + r.bought_value, 0)
  const busiest = rows.reduce((b, r) => (r.sold_qty > b.sold_qty ? r : b), rows[0])

  return {
    kind: 'table',
    title: `${itemName} — month by month`,
    subtitle: `Sales and purchases, last ${ANALYSIS_MONTHS} months`,
    columns: [
      { key: 'month',        label: 'Month' },
      { key: 'sold_qty',     label: 'Sold', kind: 'qty' },
      { key: 'sold_value',   label: 'Sales (PKR)', kind: 'money' },
      { key: 'bought_qty',   label: 'Bought', kind: 'qty' },
      { key: 'bought_value', label: 'Purchases (PKR)', kind: 'money' },
    ],
    rows,
    summary: `${qty(soldQty)} sold for ${formatPKR(soldValue)}, ${qty(boughtQty)} bought for ${formatPKR(boughtValue)}.${busiest.sold_qty > 0 ? ` Best selling month was ${busiest.month} at ${qty(busiest.sold_qty)}.` : ''}`,
    suggestions: ['Slow moving items', 'Stock summary', 'Monthly sale comparison'],
  }
}

/** Customers graded A/B/C by share of sales value. */
export async function customerGrades(admin: Admin, tenantId: string): Promise<AskResponse> {
  const raw = await rpc(admin, 'ask_customer_grades', { p_tenant_id: tenantId, p_months: ANALYSIS_MONTHS })
  if (raw.length === 0) return empty('Customer grading', `No sales recorded in the last ${ANALYSIS_MONTHS} months.`)

  const rows = raw.map((r) => ({
    grade: String(r.grade),
    name: String(r.name),
    orders: num(r.orders),
    value: num(r.value),
    share: num(r.share),
  }))

  const a = rows.filter((r) => r.grade === 'A')
  const total = rows.reduce((s, r) => s + r.value, 0)
  const aShare = a.reduce((s, r) => s + r.share, 0)

  return {
    kind: 'table',
    title: 'Customer grading',
    subtitle: `By share of sales value, last ${ANALYSIS_MONTHS} months`,
    columns: [
      { key: 'grade',  label: 'Grade' },
      { key: 'name',   label: 'Customer' },
      { key: 'orders', label: 'Orders', kind: 'number' },
      { key: 'value',  label: 'Sales (PKR)', kind: 'money' },
      { key: 'share',  label: 'Share %', kind: 'number' },
    ],
    rows,
    // Saying what the grades MEAN matters more than the letters: A/B/C is
    // meaningless unless the reader knows it is cumulative share.
    summary: `${rows.length} customers, ${formatPKR(total)} in total. ${a.length} graded A — they are ${aShare.toFixed(1)}% of your sales. A = the customers making up the first 80% of value, B = the next 15%, C = the rest.`,
    footer: `Total ${formatPKR(total)}`,
    suggestions: ['Top customers', 'Slow / inactive customers', 'Monthly sale comparison'],
  }
}

/**
 * Suppliers graded by spend, with return rate as the quality signal.
 *
 * Explicitly NOT delivery timeliness: nothing in the schema records a promised
 * or an actual delivery date, so that grade cannot be computed without
 * inventing it. The summary says so rather than letting a reader assume the
 * letters mean reliability.
 */
export async function supplierGrades(admin: Admin, tenantId: string): Promise<AskResponse> {
  const raw = await rpc(admin, 'ask_supplier_grades', { p_tenant_id: tenantId, p_months: ANALYSIS_MONTHS })
  if (raw.length === 0) return empty('Supplier grading', `No purchases recorded in the last ${ANALYSIS_MONTHS} months.`)

  const rows = raw.map((r) => ({
    grade: String(r.grade),
    name: String(r.name),
    orders: num(r.orders),
    value: num(r.value),
    share: num(r.share),
    returned: num(r.returned),
    return_rate: num(r.return_rate),
  }))

  const total = rows.reduce((s, r) => s + r.value, 0)
  const a = rows.filter((r) => r.grade === 'A')
  const returners = rows.filter((r) => r.return_rate >= 10)

  // Over 100% means more was returned than was bought — impossible in trade, so
  // it is a recording error, not a supplier being terrible. Clamping the number
  // would hide it; saying what it means turns a figure that looks like a bug
  // into something actionable.
  const overReturned = rows.filter((r) => r.return_rate > 100)

  return {
    kind: 'table',
    title: 'Supplier grading',
    subtitle: `By share of spend and return rate, last ${ANALYSIS_MONTHS} months`,
    columns: [
      { key: 'grade',       label: 'Grade' },
      { key: 'name',        label: 'Supplier' },
      { key: 'orders',      label: 'Orders', kind: 'number' },
      { key: 'value',       label: 'Purchases (PKR)', kind: 'money' },
      { key: 'share',       label: 'Share %', kind: 'number' },
      { key: 'returned',    label: 'Returned (PKR)', kind: 'money' },
      { key: 'return_rate', label: 'Return %', kind: 'number' },
    ],
    rows,
    summary: `${rows.length} suppliers, ${formatPKR(total)} spent. ${a.length} graded A.${returners.length > 0 ? ` ${returners.length} demoted for returning 10% or more of what they supplied.` : ''}${overReturned.length > 0 ? ` ⚠ ${overReturned.map((r) => r.name).join(', ')} show${overReturned.length === 1 ? 's' : ''} a return rate above 100% — more has been returned than was ever bought, which means a purchase return was recorded twice or against the wrong order. Worth correcting in Purchase Returns.` : ''} Grading is by share of spend, with return rate as the quality signal — delivery timeliness is NOT included, because no promised or actual delivery date is recorded anywhere in the system.`,
    footer: `Total ${formatPKR(total)}`,
    suggestions: ['Monthly purchase comparison', 'Who do I owe', 'Sales vs purchases'],
  }
}
