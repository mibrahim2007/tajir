export const runtime = 'nodejs'

import { and, eq, asc } from 'drizzle-orm'
import ExcelJS from 'exceljs'
import { requireAuthRoute } from '@/lib/auth/require-auth-route'
import { db } from '@/db'
import { suppliers, purchaseOrders, apPayments, inventoryLots } from '@/db/schema'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthRoute()
  if (!auth) return new Response('Unauthorized', { status: 401 })
  const { tenantId, role } = auth
  if (role !== 'owner') return new Response('Forbidden', { status: 403 })

  const { id } = await params

  const [supplier, purchases, payments, lots] = await Promise.all([
    db.select().from(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.tenantId, tenantId))).limit(1).then((r) => r[0] ?? null),
    db.select().from(purchaseOrders).where(and(eq(purchaseOrders.supplierId, id), eq(purchaseOrders.tenantId, tenantId))).orderBy(asc(purchaseOrders.date)),
    db.select().from(apPayments).where(and(eq(apPayments.supplierId, id), eq(apPayments.tenantId, tenantId))).orderBy(asc(apPayments.date)),
    db.select({ id: inventoryLots.id, name: inventoryLots.name }).from(inventoryLots).where(eq(inventoryLots.tenantId, tenantId)),
  ])

  if (!supplier) return new Response('Not Found', { status: 404 })

  const lotMap = new Map(lots.map((l) => [l.id, l.name]))

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

  const ob = parseFloat(supplier.openingBalancePkrEquivalent)
  if (ob !== 0) {
    balance += ob
    sheet.addRow({ date: supplier.createdAt.toISOString().split('T')[0], desc: 'Opening Balance', debit: Math.round(ob * 100) / 100, credit: '', balance: Math.round(balance * 100) / 100 })
  }

  type Entry = { kind: 'purchase' | 'payment'; date: string; entry: typeof purchases[0] | typeof payments[0] }
  const entries: Entry[] = [
    ...purchases.map((e) => ({ kind: 'purchase' as const, date: e.date, entry: e })),
    ...payments.map((e) => ({ kind: 'payment' as const, date: e.date, entry: e })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  for (const item of entries) {
    if (item.kind === 'purchase') {
      const e = item.entry as typeof purchases[0]
      const net = parseFloat(e.pkrEquivalent) - parseFloat(e.advancePaid)
      balance += net
      sheet.addRow({ date: item.date, desc: `Purchase — ${lotMap.get(e.stockItemId) ?? '?'} (${e.quantity} @ ${e.currencyCode} ${e.rate})`, debit: Math.round(net * 100) / 100, credit: '', balance: Math.round(balance * 100) / 100 })
    } else {
      const e = item.entry as typeof payments[0]
      const amt = parseFloat(e.pkrEquivalent)
      balance -= amt
      sheet.addRow({ date: item.date, desc: `Payment${e.paymentMethodNote ? ` — ${e.paymentMethodNote}` : ''}`, debit: '', credit: Math.round(amt * 100) / 100, balance: Math.round(balance * 100) / 100 })
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
