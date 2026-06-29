export const runtime = 'nodejs'

import ExcelJS from 'exceljs'
import { requireAuthRoute } from '@/lib/auth/require-auth-route'
import { createAdminClient } from '@/lib/supabase/admin'

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

  const admin = createAdminClient()

  const [{ data: allSuppliers }, { data: allPurchases }, { data: allPaymentsData }] = await Promise.all([
    admin.from('suppliers').select('id, name, opening_balance_pkr_equivalent, created_at').eq('tenant_id', tenantId),
    admin.from('purchase_orders').select('supplier_id, pkr_equivalent, advance_paid, date').eq('tenant_id', tenantId).order('date', { ascending: true }),
    admin.from('ap_payments').select('supplier_id, pkr_equivalent').eq('tenant_id', tenantId),
  ])

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

  let grandTotal = 0, grandB0 = 0, grandB31 = 0, grandB61 = 0, grandB90plus = 0

  for (const s of allSuppliers ?? []) {
    const sPurchases = (allPurchases ?? []).filter((p) => p.supplier_id === s.id).map((p) => ({ date: p.date, net: parseFloat(p.pkr_equivalent) - parseFloat(p.advance_paid) })).filter((p) => p.net > 0)
    const totalPaid = (allPaymentsData ?? []).filter((p) => p.supplier_id === s.id).reduce((sum, p) => sum + parseFloat(p.pkr_equivalent), 0)

    const lineItems = [
      ...(parseFloat(s.opening_balance_pkr_equivalent) > 0 ? [{ date: s.created_at.split('T')[0], amount: parseFloat(s.opening_balance_pkr_equivalent) }] : []),
      ...sPurchases.map((p) => ({ date: p.date, amount: p.net })),
    ].sort((a, b) => a.date.localeCompare(b.date))

    let remaining = totalPaid
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
      sheet.addRow({ supplier: s.name, total: Math.round(total * 100) / 100, b0_30: Math.round(b0 * 100) / 100, b31_60: Math.round(b31 * 100) / 100, b61_90: Math.round(b61 * 100) / 100, b90plus: Math.round(b90plus * 100) / 100, oldest: oldest ?? '' })
      grandTotal += total; grandB0 += b0; grandB31 += b31; grandB61 += b61; grandB90plus += b90plus
    }
  }

  const totalsRow = sheet.addRow({ supplier: 'TOTAL', total: Math.round(grandTotal * 100) / 100, b0_30: Math.round(grandB0 * 100) / 100, b31_60: Math.round(grandB31 * 100) / 100, b61_90: Math.round(grandB61 * 100) / 100, b90plus: Math.round(grandB90plus * 100) / 100, oldest: '' })
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
