export const runtime = 'nodejs'

import ExcelJS from 'exceljs'
import { requireAuthRoute } from '@/lib/auth/require-auth-route'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthRoute()
  if (!auth) return new Response('Unauthorized', { status: 401 })
  const { tenantId, role } = auth
  if (role !== 'owner') return new Response('Forbidden', { status: 403 })

  const { id } = await params

  const admin = createAdminClient()

  const [{ data: customer }, { data: rawSales }, { data: rawReceipts }, { data: rawReturns }, { data: rawCreditNotes }, { data: rawLots }] = await Promise.all([
    admin.from('tajir_customers').select('name, opening_balance_pkr_equivalent, created_at').eq('id', id).eq('tenant_id', tenantId).single(),
    admin.from('sales_orders').select('id, date, stock_item_id, quantity, rate, currency_code, pkr_equivalent').eq('customer_id', id).eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('ar_receipts').select('id, date, pkr_equivalent, payment_method_note').eq('customer_id', id).eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('sale_returns').select('id, date, stock_item_id, quantity, pkr_equivalent, reason').eq('customer_id', id).eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('credit_notes').select('id, date, pkr_equivalent, reason, reference').eq('customer_id', id).eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
  ])

  if (!customer) return new Response('Not Found', { status: 404 })

  const lotMap = new Map((rawLots ?? []).map((l) => [l.id, l.name]))

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(`${customer.name} Ledger`)
  sheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Description', key: 'desc', width: 50 },
    { header: 'Debit (PKR)', key: 'debit', width: 18 },
    { header: 'Credit (PKR)', key: 'credit', width: 18 },
    { header: 'Balance (PKR)', key: 'balance', width: 18 },
  ]
  sheet.getRow(1).font = { bold: true }

  let balance = 0

  const ob = customer.opening_balance_pkr_equivalent
  if (ob !== 0) {
    balance += ob
    sheet.addRow({ date: customer.created_at.split('T')[0], desc: 'Opening Balance', debit: Math.round(ob * 100) / 100, credit: '', balance: Math.round(balance * 100) / 100 })
  }

  type Entry =
    | { kind: 'sale'; date: string; entry: NonNullable<typeof rawSales>[0] }
    | { kind: 'receipt'; date: string; entry: NonNullable<typeof rawReceipts>[0] }
    | { kind: 'sale_return'; date: string; entry: NonNullable<typeof rawReturns>[0] }
    | { kind: 'credit_note'; date: string; entry: NonNullable<typeof rawCreditNotes>[0] }

  const entries: Entry[] = [
    ...(rawSales ?? []).map((e) => ({ kind: 'sale' as const, date: e.date, entry: e })),
    ...(rawReceipts ?? []).map((e) => ({ kind: 'receipt' as const, date: e.date, entry: e })),
    ...(rawReturns ?? []).map((e) => ({ kind: 'sale_return' as const, date: e.date, entry: e })),
    ...(rawCreditNotes ?? []).map((e) => ({ kind: 'credit_note' as const, date: e.date, entry: e })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  for (const item of entries) {
    if (item.kind === 'sale') {
      const e = item.entry as NonNullable<typeof rawSales>[0]
      const amt = e.pkr_equivalent
      balance += amt
      sheet.addRow({ date: item.date, desc: `Sale — ${lotMap.get(e.stock_item_id) ?? '?'} (${e.quantity} @ ${e.currency_code} ${e.rate})`, debit: Math.round(amt * 100) / 100, credit: '', balance: Math.round(balance * 100) / 100 })
    } else if (item.kind === 'sale_return') {
      const e = item.entry as NonNullable<typeof rawReturns>[0]
      const amt = e.pkr_equivalent
      balance -= amt
      const itemName = lotMap.get(e.stock_item_id) ?? '?'
      sheet.addRow({ date: item.date, desc: `Sale Return — ${itemName} (${e.quantity} units${e.reason ? ` — ${e.reason}` : ''})`, debit: '', credit: Math.round(amt * 100) / 100, balance: Math.round(balance * 100) / 100 })
    } else if (item.kind === 'credit_note') {
      const e = item.entry as NonNullable<typeof rawCreditNotes>[0]
      const amt = e.pkr_equivalent
      balance -= amt
      const desc = `Credit Note${e.reason ? ` — ${e.reason}` : ''}${e.reference ? ` (Ref: ${e.reference})` : ''}`
      sheet.addRow({ date: item.date, desc, debit: '', credit: Math.round(amt * 100) / 100, balance: Math.round(balance * 100) / 100 })
    } else {
      const e = item.entry as NonNullable<typeof rawReceipts>[0]
      const amt = e.pkr_equivalent
      balance -= amt
      sheet.addRow({ date: item.date, desc: `Receipt${e.payment_method_note ? ` — ${e.payment_method_note}` : ''}`, debit: '', credit: Math.round(amt * 100) / 100, balance: Math.round(balance * 100) / 100 })
    }
  }

  const numCols = ['C', 'D', 'E']
  sheet.eachRow((row, i) => {
    if (i === 1) return
    numCols.forEach((col) => { const cell = row.getCell(col); if (cell.value !== '') cell.numFmt = '#,##0.00' })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const safeName = customer.name.replace(/[^a-zA-Z0-9_-]/g, '_')
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeName}-ledger.xlsx"`,
    },
  })
}
