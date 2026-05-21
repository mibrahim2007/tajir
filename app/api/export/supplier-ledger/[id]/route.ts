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

  const [{ data: supplier }, { data: rawPurchases }, { data: rawPayments }, { data: rawLots }] = await Promise.all([
    admin.from('suppliers').select('name, opening_balance_pkr_equivalent, created_at').eq('id', id).eq('tenant_id', tenantId).single(),
    admin.from('purchase_orders').select('id, date, stock_item_id, quantity, rate, currency_code, pkr_equivalent, advance_paid').eq('supplier_id', id).eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('ap_payments').select('id, date, pkr_equivalent, payment_method_note').eq('supplier_id', id).eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
  ])

  if (!supplier) return new Response('Not Found', { status: 404 })

  const lotMap = new Map((rawLots ?? []).map((l) => [l.id, l.name]))

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(`${supplier.name} Ledger`)
  sheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Description', key: 'desc', width: 50 },
    { header: 'Debit (PKR)', key: 'debit', width: 18 },
    { header: 'Credit (PKR)', key: 'credit', width: 18 },
    { header: 'Balance (PKR)', key: 'balance', width: 18 },
  ]
  sheet.getRow(1).font = { bold: true }

  let balance = 0

  const ob = parseFloat(supplier.opening_balance_pkr_equivalent)
  if (ob !== 0) {
    balance += ob
    sheet.addRow({ date: supplier.created_at.split('T')[0], desc: 'Opening Balance', debit: Math.round(ob * 100) / 100, credit: '', balance: Math.round(balance * 100) / 100 })
  }

  type Entry =
    | { kind: 'purchase'; date: string; entry: NonNullable<typeof rawPurchases>[0] }
    | { kind: 'payment'; date: string; entry: NonNullable<typeof rawPayments>[0] }

  const entries: Entry[] = [
    ...(rawPurchases ?? []).map((e) => ({ kind: 'purchase' as const, date: e.date, entry: e })),
    ...(rawPayments ?? []).map((e) => ({ kind: 'payment' as const, date: e.date, entry: e })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  for (const item of entries) {
    if (item.kind === 'purchase') {
      const e = item.entry as NonNullable<typeof rawPurchases>[0]
      const net = parseFloat(e.pkr_equivalent) - parseFloat(e.advance_paid)
      balance += net
      sheet.addRow({ date: item.date, desc: `Purchase — ${lotMap.get(e.stock_item_id) ?? '?'} (${e.quantity} @ ${e.currency_code} ${e.rate})`, debit: Math.round(net * 100) / 100, credit: '', balance: Math.round(balance * 100) / 100 })
    } else {
      const e = item.entry as NonNullable<typeof rawPayments>[0]
      const amt = parseFloat(e.pkr_equivalent)
      balance -= amt
      sheet.addRow({ date: item.date, desc: `Payment${e.payment_method_note ? ` — ${e.payment_method_note}` : ''}`, debit: '', credit: Math.round(amt * 100) / 100, balance: Math.round(balance * 100) / 100 })
    }
  }

  const numCols = ['C', 'D', 'E']
  sheet.eachRow((row, i) => {
    if (i === 1) return
    numCols.forEach((col) => { const cell = row.getCell(col); if (cell.value !== '') cell.numFmt = '#,##0.00' })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const safeName = supplier.name.replace(/[^a-zA-Z0-9_-]/g, '_')
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeName}-ledger.xlsx"`,
    },
  })
}
