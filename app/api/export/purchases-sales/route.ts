export const runtime = 'nodejs'

import ExcelJS from 'exceljs'
import { requireAuthRoute } from '@/lib/auth/require-auth-route'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKTDate } from '@/lib/utils/dates'

function parseDate(val: string | null, fallback: string): string {
  return val && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val : fallback
}

export async function GET(req: Request) {
  const auth = await requireAuthRoute()
  if (!auth) return new Response('Unauthorized', { status: 401 })
  const { tenantId, role } = auth
  if (role !== 'owner') return new Response('Forbidden', { status: 403 })

  const url = new URL(req.url)
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 7) + '-01'
  const from = parseDate(url.searchParams.get('from'), firstOfMonth)
  const to = parseDate(url.searchParams.get('to'), today)
  const type = url.searchParams.get('type') ?? 'all'
  const location = url.searchParams.get('location') || undefined

  const admin = createAdminClient()

  let purchaseQuery = admin.from('purchase_orders')
    .select('id, date, quantity, rate, currency_code, pkr_equivalent, supplier_id, stock_item_id, location_id')
    .eq('tenant_id', tenantId).gte('date', from).lte('date', to).order('date', { ascending: false })
  if (location) purchaseQuery = purchaseQuery.eq('location_id', location)

  let salesQuery = admin.from('sales_orders')
    .select('id, date, quantity, rate, currency_code, pkr_equivalent, customer_id, stock_item_id, location_id')
    .eq('tenant_id', tenantId).gte('date', from).lte('date', to).order('date', { ascending: false })
  if (location) salesQuery = salesQuery.eq('location_id', location)

  const [
    { data: rawPurchases },
    { data: rawSales },
    { data: rawSuppliers },
    { data: rawCustomers },
    { data: rawLots },
    { data: rawLocs },
  ] = await Promise.all([
    type !== 'sales' ? purchaseQuery : Promise.resolve({ data: [] }),
    type !== 'purchases' ? salesQuery : Promise.resolve({ data: [] }),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name, count').eq('tenant_id', tenantId),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId),
  ])

  const supplierMap = new Map((rawSuppliers ?? []).map((s) => [s.id, s.name]))
  const customerMap = new Map((rawCustomers ?? []).map((c) => [c.id, c.name]))
  const lotMap = new Map((rawLots ?? []).map((l) => [l.id, `${l.name} (${l.count})`]))
  const locationMap = new Map((rawLocs ?? []).map((l) => [l.id, l.name]))

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Purchase & Sales')

  sheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Party', key: 'party', width: 28 },
    { header: 'Item', key: 'item', width: 32 },
    { header: 'Location', key: 'location', width: 20 },
    { header: 'Quantity', key: 'qty', width: 12 },
    { header: 'Rate', key: 'rate', width: 14 },
    { header: 'Currency', key: 'currency', width: 10 },
    { header: 'PKR Total', key: 'pkr', width: 18 },
  ]

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }

  const purchaseRows = (rawPurchases ?? []).map((p) => ({
    date: formatPKTDate(p.date + 'T00:00:00'),
    type: 'Purchase',
    party: supplierMap.get(p.supplier_id) ?? '—',
    item: lotMap.get(p.stock_item_id) ?? '—',
    location: p.location_id ? (locationMap.get(p.location_id) ?? '—') : '—',
    qty: parseFloat(p.quantity),
    rate: parseFloat(p.rate),
    currency: p.currency_code,
    pkr: parseFloat(p.pkr_equivalent),
    sortDate: p.date,
  }))

  const saleRows = (rawSales ?? []).map((s) => ({
    date: formatPKTDate(s.date + 'T00:00:00'),
    type: 'Sale',
    party: customerMap.get(s.customer_id) ?? '—',
    item: lotMap.get(s.stock_item_id) ?? '—',
    location: s.location_id ? (locationMap.get(s.location_id) ?? '—') : '—',
    qty: parseFloat(s.quantity),
    rate: parseFloat(s.rate),
    currency: s.currency_code,
    pkr: parseFloat(s.pkr_equivalent),
    sortDate: s.date,
  }))

  const rows = [...purchaseRows, ...saleRows].sort((a, b) => b.sortDate.localeCompare(a.sortDate))

  for (const row of rows) {
    const r = sheet.addRow(row)
    r.getCell('pkr').numFmt = '#,##0.00'
    r.getCell('qty').numFmt = '#,##0.###'
    r.getCell('rate').numFmt = '#,##0.##'
  }

  const totalPurchases = purchaseRows.reduce((s, r) => s + r.pkr, 0)
  const totalSales = saleRows.reduce((s, r) => s + r.pkr, 0)

  sheet.addRow({})
  if (type !== 'sales') {
    const pr = sheet.addRow({ party: 'TOTAL PURCHASES', pkr: Math.round(totalPurchases * 100) / 100 })
    pr.font = { bold: true }
    pr.getCell('pkr').numFmt = '#,##0.00'
  }
  if (type !== 'purchases') {
    const sr = sheet.addRow({ party: 'TOTAL SALES', pkr: Math.round(totalSales * 100) / 100 })
    sr.font = { bold: true }
    sr.getCell('pkr').numFmt = '#,##0.00'
  }
  if (type === 'all') {
    const nr = sheet.addRow({ party: 'GROSS PROFIT', pkr: Math.round((totalSales - totalPurchases) * 100) / 100 })
    nr.font = { bold: true, color: { argb: totalSales >= totalPurchases ? 'FF16A34A' : 'FFDC2626' } }
    nr.getCell('pkr').numFmt = '#,##0.00'
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="purchases-sales-${from}-to-${to}.xlsx"`,
    },
  })
}
