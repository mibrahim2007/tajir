export const runtime = 'nodejs'

import { requireApiKey, logApiRequest } from '@/lib/api-keys/require-api-key'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/v1/customers/:id/ledger
//   Authorization: Bearer tjr_live_…   (scope: ledger:read)
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD     (optional, inclusive)
//
// Mirrors app/api/export/customer-ledger/[id] but returns JSON for machines.
// Tenant comes from the key — every query below is pinned to it.

const round2 = (n: number) => Math.round(n * 100) / 100

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiKey(req, 'ledger:read')
  if (!auth.ok) return auth.response
  const { ctx } = auth
  const { tenantId } = ctx

  const { id } = await params
  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  const admin = createAdminClient()

  const [{ data: customer }, { data: rawSales }, { data: rawReceipts }, { data: rawReturns }, { data: rawCreditNotes }, { data: rawLots }] = await Promise.all([
    admin.from('tajir_customers').select('id, name, opening_balance_pkr_equivalent, created_at').eq('id', id).eq('tenant_id', tenantId).single(),
    admin.from('sales_orders').select('id, date, stock_item_id, quantity, rate, currency_code, pkr_equivalent').eq('customer_id', id).eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('ar_receipts').select('id, date, pkr_equivalent, payment_method_note').eq('customer_id', id).eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('sale_returns').select('id, date, stock_item_id, quantity, pkr_equivalent, reason').eq('customer_id', id).eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('credit_notes').select('id, date, pkr_equivalent, reason, reference').eq('customer_id', id).eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
  ])

  if (!customer) {
    await logApiRequest(req, ctx, 404)
    return Response.json({ error: 'Customer not found' }, { status: 404 })
  }

  const lotMap = new Map((rawLots ?? []).map((l) => [l.id, l.name]))

  type Line = {
    date: string
    type: 'opening_balance' | 'sale' | 'receipt' | 'sale_return' | 'credit_note'
    id: string | null
    description: string
    debit: number
    credit: number
    balance: number
  }

  const events = [
    ...(rawSales ?? []).map((e) => ({
      date: e.date, type: 'sale' as const, id: e.id, amount: e.pkr_equivalent, sign: 1,
      description: `Sale — ${lotMap.get(e.stock_item_id) ?? '?'} (${e.quantity} @ ${e.currency_code} ${e.rate})`,
    })),
    ...(rawReceipts ?? []).map((e) => ({
      date: e.date, type: 'receipt' as const, id: e.id, amount: e.pkr_equivalent, sign: -1,
      description: `Receipt${e.payment_method_note ? ` — ${e.payment_method_note}` : ''}`,
    })),
    ...(rawReturns ?? []).map((e) => ({
      date: e.date, type: 'sale_return' as const, id: e.id, amount: e.pkr_equivalent, sign: -1,
      description: `Sale Return — ${lotMap.get(e.stock_item_id) ?? '?'} (${e.quantity} units${e.reason ? ` — ${e.reason}` : ''})`,
    })),
    ...(rawCreditNotes ?? []).map((e) => ({
      date: e.date, type: 'credit_note' as const, id: e.id, amount: e.pkr_equivalent, sign: -1,
      description: `Credit Note${e.reason ? ` — ${e.reason}` : ''}${e.reference ? ` (Ref: ${e.reference})` : ''}`,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  // Running balance is always computed from the start so a date-filtered
  // window still opens with the correct carried-forward balance.
  let balance = customer.opening_balance_pkr_equivalent
  const lines: Line[] = []
  const openingDate = customer.created_at.split('T')[0]

  if (!from || openingDate >= from) {
    if (customer.opening_balance_pkr_equivalent !== 0) {
      lines.push({ date: openingDate, type: 'opening_balance', id: null, description: 'Opening Balance', debit: round2(balance), credit: 0, balance: round2(balance) })
    }
  }

  let broughtForward = customer.opening_balance_pkr_equivalent
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

  const body = {
    customer: { id: customer.id, name: customer.name },
    period: { from, to },
    brought_forward: from ? round2(broughtForward) : null,
    closing_balance: round2(lines.length ? lines[lines.length - 1].balance : broughtForward),
    currency: 'PKR',
    lines,
  }

  await logApiRequest(req, ctx, 200, lines.length)
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
