import ExcelJS from 'exceljs'
import { requireAuthRoute } from '@/lib/auth/require-auth-route'
import { buildPendingInvoices, parsePendingFilters, PENDING_SIDES, type PendingSide } from '@/lib/reports/pending-invoices'

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Excel export for the Pending Receivables / Payables reports — same builder
 * and filters as the on-screen report, so the two cannot disagree.
 */
export async function pendingInvoicesExport(request: Request, side: PendingSide): Promise<Response> {
  const auth = await requireAuthRoute()
  if (!auth) return new Response('Unauthorized', { status: 401 })
  const { tenantId, role } = auth
  if (role !== 'owner') return new Response('Forbidden', { status: 403 })

  const labels = PENDING_SIDES[side]
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const { parties, totals } = await buildPendingInvoices(tenantId, side, parsePendingFilters(params))

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(side === 'receivable' ? 'Pending Receivables' : 'Pending Payables')

  sheet.columns = [
    { header: labels.party, key: 'party', width: 28 },
    { header: 'Invoice', key: 'invoice', width: 16 },
    { header: `${labels.ref} No`, key: 'ref', width: 14 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Due Date', key: 'due', width: 12 },
    { header: 'Days Overdue', key: 'overdue', width: 13 },
    { header: 'Age (days)', key: 'age', width: 11 },
    { header: 'Invoice Amount', key: 'amount', width: 16 },
    { header: labels.returned, key: 'returned', width: 14 },
    { header: labels.applied, key: 'applied', width: 14 },
    { header: 'Adjusted (FIFO)', key: 'fifo', width: 15 },
    { header: 'Balance', key: 'balance', width: 16 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const p of parties) {
    for (const r of p.rows) {
      sheet.addRow({
        party:    p.partyName,
        invoice:  r.isOpening ? 'Opening balance' : (r.serial ?? ''),
        ref:      r.ref ?? '',
        date:     r.date,
        due:      r.dueDate ?? '',
        overdue:  r.overdueDays ?? '',
        age:      r.age,
        amount:   r2(r.amount),
        returned: r2(r.returned),
        applied:  r2(r.applied),
        fifo:     r2(r.fifo),
        balance:  r2(r.balance),
      })
    }
    sheet.addRow({ party: `${p.partyName} — total`, balance: r2(p.total) }).font = { bold: true }
  }

  sheet.addRow({})
  sheet.addRow({
    party:    'TOTAL PENDING',
    amount:   r2(totals.amount),
    returned: r2(totals.returned),
    applied:  r2(totals.applied),
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
      'Content-Disposition': `attachment; filename="${labels.filename}"`,
    },
  })
}
