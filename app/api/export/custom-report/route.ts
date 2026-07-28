export const runtime = 'nodejs'

import ExcelJS from 'exceljs'
import { requireAuthRoute } from '@/lib/auth/require-auth-route'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchReportDefinition, computeCustomReport } from '@/lib/reports/custom-report'

const r2 = (n: number) => Math.round(n * 100) / 100
const isDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)

// Exports a user-defined statement. Built from the SAME definition + engine the
// on-screen report uses, so the spreadsheet cannot disagree with what was
// exported from.
export async function GET(request: Request) {
  const auth = await requireAuthRoute()
  if (!auth) return new Response('Unauthorized', { status: 401 })
  const { tenantId } = auth

  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return new Response('Missing report id', { status: 400 })

  const today = new Date().toISOString().split('T')[0]
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')
  const from = isDate(fromParam) ? fromParam : today.slice(0, 8) + '01'
  const to = isDate(toParam) ? toParam : today

  const admin = createAdminClient()
  const definition = await fetchReportDefinition({ admin, tenantId, reportId: id })
  if (!definition) return new Response('Report not found', { status: 404 })

  const report = await computeCustomReport({ admin, tenantId, definition, from, to })

  const workbook = new ExcelJS.Workbook()
  // Excel rejects : \ / ? * [ ] in sheet names and caps them at 31 characters.
  const sheetName = definition.name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Report'
  const sheet = workbook.addWorksheet(sheetName)

  sheet.columns = [
    { header: 'Code', key: 'code', width: 12 },
    { header: 'Description', key: 'label', width: 46 },
    { header: 'Amount (PKR)', key: 'amount', width: 18 },
  ]
  sheet.getRow(1).font = { bold: true }

  sheet.addRow({
    code: '',
    label: definition.basis === 'period' ? `Period: ${from} to ${to}` : `As of: ${to}`,
    amount: null,
  }).font = { italic: true }

  for (const row of report.rows) {
    if (row.kind === 'spacer') { sheet.addRow({}); continue }

    const added = sheet.addRow({
      code: row.code ?? '',
      // Indentation is carried in the text so the export keeps the layout's shape.
      label: '    '.repeat(row.indent) + row.label,
      amount: row.amount === null ? null : r2(row.amount),
    })

    if (row.kind === 'header' || row.isBold) added.font = { bold: true }
    if (row.underline) added.getCell('C').border = { top: { style: 'thin' } }
  }

  if (report.unmapped.length > 0) {
    sheet.addRow({})
    sheet.addRow({ code: '', label: 'Accounts with a balance not mapped to any line', amount: null }).font = { bold: true }
    for (const a of report.unmapped) {
      sheet.addRow({ code: a.code, label: a.name, amount: r2(a.amount) })
    }
  }

  sheet.eachRow((row, i) => { if (i > 1) row.getCell('C').numFmt = '#,##0.00' })

  const buffer = await workbook.xlsx.writeBuffer()
  const fileName = definition.name.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'custom-report'

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}.xlsx"`,
    },
  })
}
