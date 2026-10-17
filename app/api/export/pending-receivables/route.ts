export const runtime = 'nodejs'

import ExcelJS from 'exceljs'
import { requireAuthRoute } from '@/lib/auth/require-auth-route'
import { buildPendingReceivables, parsePendingFilters } from '@/lib/reports/pending-receivables'

const r2 = (n: number) => Math.round(n * 100) / 100

export async function GET(request: Request) {
  const auth = await requireAuthRoute()
  if (!auth) return new Response('Unauthorized', { status: 401 })
  const { tenantId, role } = auth
  if (role !== 'owner') return new Response('Forbidden', { status: 403 })

  // Same builder and filters as the on-screen report.
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const { customers, totals } = await buildPendingReceivables(tenantId, parsePendingFilters(params))

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Pending Receivables')

  sheet.columns = [
    { header: 'Customer', key: 'customer', width: 28 },
    { header: 'Invoice', key: 'invoice', width: 16 },
    { header: 'PO No', key: 'po', width: 14 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Due Date', key: 'due', width: 12 },
    { header: 'Days Overdue', key: 'overdue', width: 13 },
    { header: 'Age (days)', key: 'age', width: 11 },
    { header: 'Invoice Amount', key: 'amount', width: 16 },
    { header: 'Returns / CN', key: 'returned', width: 14 },
    { header: 'Received', key: 'received', width: 14 },
    { header: 'Adjusted (FIFO)', key: 'fifo', width: 15 },
    { header: 'Balance', key: 'balance', width: 16 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const c of customers) {
    for (const r of c.rows) {
      sheet.addRow({
        customer: c.customerName,
        invoice:  r.isOpening ? 'Opening balance' : (r.serial ?? ''),
        po:       r.poNo ?? '',
        date:     r.date,
        due:      r.dueDate ?? '',
        overdue:  r.overdueDays ?? '',
        age:      r.age,
        amount:   r2(r.amount),
        returned: r2(r.returned),
        received: r2(r.received),
        fifo:     r2(r.fifo),
        balance:  r2(r.balance),
      })
    }
    sheet.addRow({ customer: `${c.customerName} — total`, balance: r2(c.total) }).font = { bold: true }
  }

  sheet.addRow({})
  sheet.addRow({
    customer: 'TOTAL PENDING',
    amount:   r2(totals.amount),
    returned: r2(totals.returned),
    received: r2(totals.received),
    fifo:     r2(totals.fifo),
    balance:  r2(totals.balance),
  }).font = { bold: true }

  sheet.eachRow((row, i) => {
    if (i === 1) return
    ;['H', 'I', 'J', 'K', 'L'].forEach((col) => { row.getCell(col).numFmt = '#,##0.00' })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="pending-receivables.xlsx"',
    },
  })
}
