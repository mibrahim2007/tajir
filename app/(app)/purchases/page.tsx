import Link from 'next/link'
import { Suspense } from 'react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { EditPurchaseForm } from './edit-purchase-form'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deletePurchaseAction } from '@/app/actions/delete-purchase'
import { deletePurchaseInvoiceAction } from '@/app/actions/delete-purchase-invoice'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate, formatPKTDateTime } from '@/lib/utils/dates'
import { PurchaseFilters } from './purchase-filters'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function PurchasesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const filterFrom     = typeof params.from     === 'string' ? params.from     : undefined
  const filterTo       = typeof params.to       === 'string' ? params.to       : undefined
  const filterSupplier = typeof params.supplier === 'string' ? params.supplier : undefined
  const filterItem     = typeof params.item     === 'string' ? params.item     : undefined
  const filterLocation = typeof params.location === 'string' ? params.location : undefined

  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  let query = admin.from('purchase_orders')
    .select('id, serial_number, invoice_id, date, created_at, quantity, rate, currency_code, exchange_rate, pkr_equivalent, advance_paid, supplier_id, stock_item_id, location_id')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000)

  if (filterFrom)     query = query.gte('date', filterFrom)
  if (filterTo)       query = query.lte('date', filterTo)
  if (filterSupplier) query = query.eq('supplier_id', filterSupplier)
  if (filterItem)     query = query.eq('stock_item_id', filterItem)
  if (filterLocation) query = query.eq('location_id', filterLocation)

  const [{ data: rawOrders }, { data: rawSuppliers }, { data: rawLots }, { data: rawLocs }] = await Promise.all([
    query,
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name, count, unit_of_measure').eq('tenant_id', tenantId).order('name'),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId).order('name'),
  ])

  const orders      = rawOrders ?? []
  const supplierList = rawSuppliers ?? []
  const lotList      = (rawLots ?? []).map((l) => ({ ...l, count: String(l.count ?? ''), unitOfMeasure: l.unit_of_measure ?? null }))
  const locationList = rawLocs ?? []

  const supplierMap = new Map(supplierList.map((s) => [s.id, s.name]))
  const lotMap      = new Map(lotList.map((l) => [l.id, l.name]))

  // Group by invoice_id; solo orders (no invoice_id) kept individually
  type OrderRow = typeof orders[0]
  const invoiceMap = new Map<string, OrderRow[]>()
  const soloOrders: OrderRow[] = []

  for (const o of orders) {
    if (o.invoice_id) {
      const existing = invoiceMap.get(o.invoice_id) ?? []
      existing.push(o)
      invoiceMap.set(o.invoice_id, existing)
    } else {
      soloOrders.push(o)
    }
  }

  type DisplayItem = {
    key: string
    type: 'invoice' | 'solo'
    invoiceId?: string
    serialNumber: string | null
    date: string
    createdAt: string
    supplierId: string
    stockItemIds: string[]
    itemCount: number
    totalQty: number
    totalPKR: number
    advancePaid: number
    currencyCode: string
    exchangeRate: string
    soloOrder?: OrderRow
    // The underlying order for any single-line row (solo, or a 1-item
    // invoice) — used to enable inline editing of that one line.
    singleOrder?: OrderRow
  }

  const displayItems: DisplayItem[] = []

  for (const [invoiceId, lines] of invoiceMap) {
    displayItems.push({
      key: invoiceId,
      type: 'invoice',
      invoiceId,
      serialNumber: lines[0].serial_number,
      date:        lines[0].date,
      createdAt:   lines[0].created_at,
      supplierId:  lines[0].supplier_id,
      stockItemIds: lines.map((l) => l.stock_item_id),
      itemCount:   lines.length,
      totalQty:    lines.reduce((s, l) => s + parseFloat(l.quantity), 0),
      totalPKR:    lines.reduce((s, l) => s + parseFloat(l.pkr_equivalent), 0),
      advancePaid: lines.reduce((s, l) => s + parseFloat(l.advance_paid ?? '0'), 0),
      currencyCode: lines[0].currency_code,
      exchangeRate: lines[0].exchange_rate,
      singleOrder: lines.length === 1 ? lines[0] : undefined,
    })
  }

  for (const o of soloOrders) {
    displayItems.push({
      key:         o.id,
      type:        'solo',
      serialNumber: o.serial_number,
      date:        o.date,
      createdAt:   o.created_at,
      supplierId:  o.supplier_id,
      stockItemIds: [o.stock_item_id],
      itemCount:   1,
      totalQty:    parseFloat(o.quantity),
      totalPKR:    parseFloat(o.pkr_equivalent),
      advancePaid: parseFloat(o.advance_paid ?? '0'),
      currencyCode: o.currency_code,
      exchangeRate: o.exchange_rate,
      soloOrder:   o,
      singleOrder: o,
    })
  }

  displayItems.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date)
    return b.createdAt.localeCompare(a.createdAt)
  })

  const hasFilters = filterFrom || filterTo || filterSupplier || filterItem || filterLocation
  const totalQty   = displayItems.reduce((s, i) => s + i.totalQty, 0)
  const totalPKR   = displayItems.reduce((s, i) => s + i.totalPKR, 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Purchases</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {displayItems.length} entr{displayItems.length !== 1 ? 'ies' : 'y'}{hasFilters ? ' (filtered)' : ''}
          </p>
        </div>
        <Link href="/purchases/new">
          <Button className="min-h-[44px]">New Purchase</Button>
        </Link>
      </div>

      <Suspense>
        <PurchaseFilters suppliers={supplierList} lots={lotList} locations={locationList} />
      </Suspense>

      {displayItems.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            {hasFilters ? 'No purchases match your filters.' : 'No purchases yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Serial #</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Supplier</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Items</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Qty</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">PKR Total</th>
                  <th className="px-4 py-3 w-36" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayItems.map((item) => (
                  <tr key={item.key} className="hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-medium tabular-nums">{item.serialNumber ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="block">{formatPKTDate(new Date(item.date))}</span>
                      <span className="block text-[11px] text-muted-foreground tabular-nums">
                        {formatPKTDateTime(new Date(item.createdAt)).split(', ')[1]}
                      </span>
                    </td>
                    <td className="px-4 py-3">{supplierMap.get(item.supplierId) ?? '—'}</td>
                    <td className="px-4 py-3">
                      {item.type === 'invoice'
                        ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <span className="font-medium text-foreground">{item.itemCount} items</span>
                            <span className="text-xs">({item.stockItemIds.map((id) => lotMap.get(id) ?? '?').join(', ')})</span>
                          </span>
                        )
                        : <span>{lotMap.get(item.stockItemIds[0]) ?? '—'}</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.totalQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPKR(item.totalPKR)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link href={item.type === 'invoice' ? `/purchases/invoice/${item.invoiceId}/print` : `/purchases/${item.soloOrder!.id}/print`}>
                          <Button variant="ghost" size="sm" className="min-h-[36px]">Print</Button>
                        </Link>
                        <RoleGate allowedRoles={['owner']}>
                          {item.singleOrder && (
                            <EditPurchaseForm
                              purchase={{ id: item.singleOrder.id, supplierId: item.singleOrder.supplier_id, stockItemId: item.singleOrder.stock_item_id, quantity: item.singleOrder.quantity, rate: item.singleOrder.rate, currencyCode: item.singleOrder.currency_code, exchangeRate: item.singleOrder.exchange_rate, advancePaid: item.singleOrder.advance_paid, date: item.singleOrder.date, locationId: item.singleOrder.location_id }}
                              suppliers={supplierList}
                              lots={lotList}
                              locations={locationList}
                            />
                          )}
                          <DeleteButton
                            description={item.type === 'invoice'
                              ? `Delete this invoice (${item.itemCount} items)? Stock quantities will be reversed.`
                              : 'Delete this purchase? Stock quantity will be restored.'}
                            onDelete={item.type === 'invoice'
                              ? deletePurchaseInvoiceAction.bind(null, { invoiceId: item.invoiceId! })
                              : deletePurchaseAction.bind(null, { id: item.soloOrder!.id })}
                          />
                        </RoleGate>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-muted/30">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold">{totalQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold">{formatPKR(totalPKR)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
