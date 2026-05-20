export const runtime = 'nodejs'

import { and, eq, ilike } from 'drizzle-orm'
import ExcelJS from 'exceljs'
import { requireAuthRoute } from '@/lib/auth/require-auth-route'
import { db } from '@/db'
import { inventoryLots, suppliers } from '@/db/schema'

export async function GET(req: Request) {
  const auth = await requireAuthRoute()
  if (!auth) return new Response('Unauthorized', { status: 401 })
  const { tenantId, role } = auth
  if (role !== 'owner') return new Response('Forbidden', { status: 403 })

  const url = new URL(req.url)
  const filterCount = url.searchParams.get('count') ?? undefined
  const filterType = url.searchParams.get('type') ?? undefined
  const filterFiber = url.searchParams.get('fiber') ?? undefined
  const filterLot = url.searchParams.get('lot') ?? undefined

  const conditions = [
    eq(inventoryLots.tenantId, tenantId),
    ...(filterCount ? [ilike(inventoryLots.count, `%${filterCount}%`)] : []),
    ...(filterType ? [eq(inventoryLots.type, filterType)] : []),
    ...(filterFiber ? [ilike(inventoryLots.fiber, `%${filterFiber}%`)] : []),
    ...(filterLot ? [ilike(inventoryLots.lot, `%${filterLot}%`)] : []),
  ]

  const [lots, allSuppliers] = await Promise.all([
    db.select().from(inventoryLots).where(and(...conditions)),
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.tenantId, tenantId)),
  ])

  const supplierMap = new Map(allSuppliers.map((s) => [s.id, s.name]))

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Stock Summary')
  sheet.columns = [
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Code', key: 'code', width: 14 },
    { header: 'Count', key: 'count', width: 12 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Fiber', key: 'fiber', width: 16 },
    { header: 'Lot', key: 'lot', width: 14 },
    { header: 'Default Supplier', key: 'supplier', width: 24 },
    { header: 'Current Quantity', key: 'qty', width: 18 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const lot of lots) {
    sheet.addRow({
      name: lot.name,
      code: lot.code ?? '',
      count: lot.count,
      type: lot.type ?? '',
      fiber: lot.fiber ?? '',
      lot: lot.lot ?? '',
      supplier: lot.defaultSupplierId ? (supplierMap.get(lot.defaultSupplierId) ?? '') : '',
      qty: parseFloat(lot.currentQuantity),
    })
  }

  sheet.eachRow((row, i) => {
    if (i === 1) return
    row.getCell('H').numFmt = '#,##0.000'
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="stock-summary.xlsx"',
    },
  })
}
