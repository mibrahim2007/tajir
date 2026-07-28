export const runtime = 'nodejs'

import ExcelJS from 'exceljs'
import { requireAuthRoute } from '@/lib/auth/require-auth-route'
import { buildReceivablesAging, buildEmployeeLoanAging, sumBuckets, type AgingRow } from '@/lib/reports/aging'

const r2 = (n: number) => Math.round(n * 100) / 100

export async function GET() {
  const auth = await requireAuthRoute()
  if (!auth) return new Response('Unauthorized', { status: 401 })
  const { tenantId, role } = auth
  if (role !== 'owner') return new Response('Forbidden', { status: 403 })

  // Same builders as the on-screen report, so the spreadsheet cannot disagree
  // with what was exported from.
  const [customerRows, employeeRows] = await Promise.all([
    buildReceivablesAging(tenantId),
    buildEmployeeLoanAging(tenantId),
  ])

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Receivables Aging')

  sheet.columns = [
    { header: 'Party', key: 'customer', width: 30 },
    { header: 'Total Outstanding (PKR)', key: 'total', width: 24 },
    { header: '0–30 Days', key: 'b0_30', width: 16 },
    { header: '31–60 Days', key: 'b31_60', width: 16 },
    { header: '61–90 Days', key: 'b61_90', width: 16 },
    { header: '90+ Days', key: 'b90plus', width: 16 },
    { header: 'Oldest Due Date', key: 'oldest', width: 20 },
  ]

  sheet.getRow(1).font = { bold: true }

  const addSection = (heading: string, rows: AgingRow[], totalLabel: string) => {
    if (rows.length === 0) return
    sheet.addRow({ customer: heading }).font = { bold: true }
    for (const r of rows) {
      sheet.addRow({
        customer: r.partyName,
        total:    r2(r.total),
        b0_30:    r2(r.bucket0_30),
        b31_60:   r2(r.bucket31_60),
        b61_90:   r2(r.bucket61_90),
        b90plus:  r2(r.bucket90plus),
        oldest:   r.oldestDate ?? '',
      })
    }
    const t = sumBuckets(rows)
    sheet.addRow({
      customer: totalLabel,
      total:    r2(t.total),
      b0_30:    r2(t.bucket0_30),
      b31_60:   r2(t.bucket31_60),
      b61_90:   r2(t.bucket61_90),
      b90plus:  r2(t.bucket90plus),
      oldest:   '',
    }).font = { bold: true }
    sheet.addRow({})
  }

  addSection('Trade Receivables — Customers', customerRows, 'Total Customers')
  addSection('Employee Loans & Advances — not yet recovered', employeeRows, 'Total Employees')

  const totals = sumBuckets([...customerRows, ...employeeRows])
  const totalsRow = sheet.addRow({
    customer: 'TOTAL RECEIVABLE',
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
      'Content-Disposition': 'attachment; filename="receivables-aging.xlsx"',
    },
  })
}
