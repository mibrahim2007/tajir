export const runtime = 'nodejs'

import { eq, asc } from 'drizzle-orm'
import ExcelJS from 'exceljs'
import { requireAuthRoute } from '@/lib/auth/require-auth-route'
import { db } from '@/db'
import { tajirCustomers, salesOrders, arReceipts } from '@/db/schema'

function ageDays(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - new Date(dateStr).getTime()) / 86_400_000)
}

export async function GET() {
  const auth = await requireAuthRoute()
  if (!auth) return new Response('Unauthorized', { status: 401 })

  const { tenantId, role } = auth
  if (role !== 'owner') return new Response('Forbidden', { status: 403 })

  const [allCustomers, allSales, allReceiptsData] = await Promise.all([
    db.select().from(tajirCustomers).where(eq(tajirCustomers.tenantId, tenantId)),
    db.select().from(salesOrders).where(eq(salesOrders.tenantId, tenantId)).orderBy(asc(salesOrders.date)),
    db.select({ customerId: arReceipts.customerId, pkrEquivalent: arReceipts.pkrEquivalent })
      .from(arReceipts).where(eq(arReceipts.tenantId, tenantId)),
  ])

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Receivables Aging')

  sheet.columns = [
    { header: 'Customer', key: 'customer', width: 30 },
    { header: 'Total Outstanding (PKR)', key: 'total', width: 24 },
    { header: '0–30 Days', key: 'b0_30', width: 16 },
    { header: '31–60 Days', key: 'b31_60', width: 16 },
    { header: '61–90 Days', key: 'b61_90', width: 16 },
    { header: '90+ Days', key: 'b90plus', width: 16 },
    { header: 'Oldest Invoice Date', key: 'oldest', width: 20 },
  ]

  sheet.getRow(1).font = { bold: true }

  let grandTotal = 0, grandB0 = 0, grandB31 = 0, grandB61 = 0, grandB90plus = 0

  for (const c of allCustomers) {
    const cSales = allSales.filter((s) => s.customerId === c.id).map((s) => ({ date: s.date, amount: parseFloat(s.pkrEquivalent) }))
    const totalReceived = allReceiptsData.filter((r) => r.customerId === c.id).reduce((sum, r) => sum + parseFloat(r.pkrEquivalent), 0)

    const lineItems = [
      ...(parseFloat(c.openingBalancePkrEquivalent) > 0 ? [{ date: c.createdAt.toISOString().split('T')[0], amount: parseFloat(c.openingBalancePkrEquivalent) }] : []),
      ...cSales,
    ].sort((a, b) => a.date.localeCompare(b.date))

    let remaining = totalReceived
    let total = 0, b0 = 0, b31 = 0, b61 = 0, b90plus = 0
    let oldest: string | null = null

    for (const line of lineItems) {
      let amt = line.amount
      if (remaining > 0) { const a = Math.min(remaining, amt); amt -= a; remaining -= a }
      if (amt <= 0) continue
      total += amt
      if (!oldest || line.date < oldest) oldest = line.date
      const age = ageDays(line.date)
      if (age <= 30) b0 += amt
      else if (age <= 60) b31 += amt
      else if (age <= 90) b61 += amt
      else b90plus += amt
    }

    if (total > 0.005) {
      sheet.addRow({ customer: c.name, total: Math.round(total * 100) / 100, b0_30: Math.round(b0 * 100) / 100, b31_60: Math.round(b31 * 100) / 100, b61_90: Math.round(b61 * 100) / 100, b90plus: Math.round(b90plus * 100) / 100, oldest: oldest ?? '' })
      grandTotal += total; grandB0 += b0; grandB31 += b31; grandB61 += b61; grandB90plus += b90plus
    }
  }

  const totalsRow = sheet.addRow({ customer: 'TOTAL', total: Math.round(grandTotal * 100) / 100, b0_30: Math.round(grandB0 * 100) / 100, b31_60: Math.round(grandB31 * 100) / 100, b61_90: Math.round(grandB61 * 100) / 100, b90plus: Math.round(grandB90plus * 100) / 100, oldest: '' })
  totalsRow.font = { bold: true }

  const numCols = ['B', 'C', 'D', 'E', 'F']
  sheet.eachRow((row, i) => {
    if (i === 1) return
    numCols.forEach((col) => { const cell = row.getCell(col); cell.numFmt = '#,##0.00' })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="receivables-aging.xlsx"',
    },
  })
}
