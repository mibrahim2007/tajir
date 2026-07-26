export const runtime = 'nodejs'

import ExcelJS from 'exceljs'
import { requireAuthRoute } from '@/lib/auth/require-auth-route'
import { buildPayablesAging, sumBuckets } from '@/lib/reports/aging'

const r2 = (n: number) => Math.round(n * 100) / 100

export async function GET() {
  const auth = await requireAuthRoute()
  if (!auth) return new Response('Unauthorized', { status: 401 })
  const { tenantId, role } = auth
  if (role !== 'owner') return new Response('Forbidden', { status: 403 })

  // Same builder as the on-screen report, so the spreadsheet cannot disagree
  // with what was exported from.
  const rows = await buildPayablesAging(tenantId)
  const totals = sumBuckets(rows)

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Payables Aging')

  sheet.columns = [
    { header: 'Supplier', key: 'supplier', width: 30 },
    { header: 'Total Outstanding (PKR)', key: 'total', width: 24 },
    { header: '0–30 Days', key: 'b0_30', width: 16 },
    { header: '31–60 Days', key: 'b31_60', width: 16 },
    { header: '61–90 Days', key: 'b61_90', width: 16 },
    { header: '90+ Days', key: 'b90plus', width: 16 },
    { header: 'Oldest Purchase Date', key: 'oldest', width: 20 },
  ]

  sheet.getRow(1).font = { bold: true }

  for (const r of rows) {
    sheet.addRow({
      supplier: r.partyName,
      total:    r2(r.total),
      b0_30:    r2(r.bucket0_30),
      b31_60:   r2(r.bucket31_60),
      b61_90:   r2(r.bucket61_90),
      b90plus:  r2(r.bucket90plus),
      oldest:   r.oldestDate ?? '',
    })
  }

  const totalsRow = sheet.addRow({
    supplier: 'TOTAL',
    total:    r2(totals.total),
    b0_30:    r2(totals.bucket0_30),
    b31_60:   r2(totals.bucket31_60),
    b61_90:   r2(totals.bucket61_90),
    b90plus:  r2(totals.bucket90plus),
    oldest:   '',
  })
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
      'Content-Disposition': 'attachment; filename="payables-aging.xlsx"',
    },
  })
}
