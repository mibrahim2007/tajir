export const runtime = 'nodejs'

import { and, eq, asc } from 'drizzle-orm'
import ExcelJS from 'exceljs'
import { requireAuthRoute } from '@/lib/auth/require-auth-route'
import { db } from '@/db'
import { tajirCustomers, salesOrders, arReceipts, inventoryLots } from '@/db/schema'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthRoute()
  if (!auth) return new Response('Unauthorized', { status: 401 })
  const { tenantId, role } = auth
  if (role !== 'owner') return new Response('Forbidden', { status: 403 })

  const { id } = await params

  const [customer, sales, receipts, lots] = await Promise.all([
    db.select().from(tajirCustomers).where(and(eq(tajirCustomers.id, id), eq(tajirCustomers.tenantId, tenantId))).limit(1).then((r) => r[0] ?? null),
    db.select().from(salesOrders).where(and(eq(salesOrders.customerId, id), eq(salesOrders.tenantId, tenantId))).orderBy(asc(salesOrders.date)),
    db.select().from(arReceipts).where(and(eq(arReceipts.customerId, id), eq(arReceipts.tenantId, tenantId))).orderBy(asc(arReceipts.date)),
    db.select({ id: inventoryLots.id, name: inventoryLots.name }).from(inventoryLots).where(eq(inventoryLots.tenantId, tenantId)),
  ])

  if (!customer) return new Response('Not Found', { status: 404 })

  const lotMap = new Map(lots.map((l) => [l.id, l.name]))

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

  const ob = parseFloat(customer.openingBalancePkrEquivalent)
  if (ob !== 0) {
    balance += ob
    sheet.addRow({ date: customer.createdAt.toISOString().split('T')[0], desc: 'Opening Balance', debit: Math.round(ob * 100) / 100, credit: '', balance: Math.round(balance * 100) / 100 })
  }

  type Entry = { kind: 'sale' | 'receipt'; date: string; entry: typeof sales[0] | typeof receipts[0] }
  const entries: Entry[] = [
    ...sales.map((e) => ({ kind: 'sale' as const, date: e.date, entry: e })),
    ...receipts.map((e) => ({ kind: 'receipt' as const, date: e.date, entry: e })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  for (const item of entries) {
    if (item.kind === 'sale') {
      const e = item.entry as typeof sales[0]
      const amt = parseFloat(e.pkrEquivalent)
      balance += amt
      sheet.addRow({ date: item.date, desc: `Sale — ${lotMap.get(e.stockItemId) ?? '?'} (${e.quantity} @ ${e.currencyCode} ${e.rate})`, debit: Math.round(amt * 100) / 100, credit: '', balance: Math.round(balance * 100) / 100 })
    } else {
      const e = item.entry as typeof receipts[0]
      const amt = parseFloat(e.pkrEquivalent)
      balance -= amt
      sheet.addRow({ date: item.date, desc: `Receipt${e.paymentMethodNote ? ` — ${e.paymentMethodNote}` : ''}`, debit: '', credit: Math.round(amt * 100) / 100, balance: Math.round(balance * 100) / 100 })
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
