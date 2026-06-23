import Link from 'next/link'
import { Suspense } from 'react'
import { Plus, AlertTriangle } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { EditSaleForm } from './edit-sale-form'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deleteSaleAction } from '@/app/actions/delete-sale'
import { deleteSaleInvoiceAction } from '@/app/actions/delete-sale-invoice'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { SaleFilters } from './sale-filters'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function SalesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const filterFrom     = typeof params.from     === 'string' ? params.from     : undefined
  const filterTo       = typeof params.to       === 'string' ? params.to       : undefined
  const filterCustomer = typeof params.customer === 'string' ? params.customer : undefined
  const filterItem     = typeof params.item     === 'string' ? params.item     : undefined

  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  let query = admin.from('sales_orders')
    .select('id, invoice_id, date, customer_id, stock_item_id, quantity, rate, currency_code, exchange_rate, pkr_equivalent, payment_due_date')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000)

  if (filterFrom)     query = query.gte('date', filterFrom)
  if (filterTo)       query = query.lte('date', filterTo)
  if (filterCustomer) query = query.eq('customer_id', filterCustomer)
  if (filterItem)     query = query.eq('stock_item_id', filterItem)

  const [{ data: rawOrders }, { data: rawCustomers }, { data: rawLots }, { data: rawPurchases }] = await Promise.all([
    query,
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('purchase_orders').select('stock_item_id, pkr_equivalent, quantity')
      .eq('tenant_id', tenantId).order('date', { ascending: false }).order('created_at', { ascending: false }),
  ])

  const orders    = rawOrders ?? []
  const customers = rawCustomers ?? []
  const lots      = rawLots ?? []

  const costMap: Record<string, number> = {}
  for (const p of rawPurchases ?? []) {
    if (!costMap[p.stock_item_id])
      costMap[p.stock_item_id] = parseFloat(p.pkr_equivalent) / parseFloat(p.quantity)
  }

  const customerMap = new Map(customers.map((c) => [c.id, c.name]))
  const lotMap      = new Map(lots.map((l) => [l.id, l.name]))

  // Group by invoice_id; solo orders kept individually
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
    date: string
    customerId: string
    stockItemIds: string[]
    itemCount: number
    totalQty: number
    totalPKR: number
    paymentDueDate?: string | null
    currencyCode: string
    hasAnyBelowCost: boolean
    soloOrder?: OrderRow
  }

  const displayItems: DisplayItem[] = []

  for (const [invoiceId, lines] of invoiceMap) {
    const hasAnyBelowCost = lines.some((l) => {
      const cost = costMap[l.stock_item_id]
      const ratePKR = parseFloat(l.rate) * parseFloat(l.exchange_rate)
      return cost !== undefined && ratePKR < cost
    })
    displayItems.push({
      key:          invoiceId,
      type:         'invoice',
      invoiceId,
      date:         lines[0].date,
      customerId:   lines[0].customer_id,
      stockItemIds: lines.map((l) => l.stock_item_id),
      itemCount:    lines.length,
      totalQty:     lines.reduce((s, l) => s + parseFloat(l.quantity), 0),
      totalPKR:     lines.reduce((s, l) => s + parseFloat(l.pkr_equivalent), 0),
      paymentDueDate: lines[0].payment_due_date,
      currencyCode: lines[0].currency_code,
      hasAnyBelowCost,
    })
  }

  for (const o of soloOrders) {
    const cost = costMap[o.stock_item_id]
    const ratePKR = parseFloat(o.rate) * parseFloat(o.exchange_rate)
    const belowCost = cost !== undefined && ratePKR < cost
    displayItems.push({
      key:          o.id,
      type:         'solo',
      date:         o.date,
      customerId:   o.customer_id,
      stockItemIds: [o.stock_item_id],
      itemCount:    1,
      totalQty:     parseFloat(o.quantity),
      totalPKR:     parseFloat(o.pkr_equivalent),
      paymentDueDate: o.payment_due_date,
      currencyCode: o.currency_code,
      hasAnyBelowCost: belowCost,
      soloOrder:    o,
    })
  }

  displayItems.sort((a, b) => b.date.localeCompare(a.date))

  const hasFilters = filterFrom || filterTo || filterCustomer || filterItem
  const totalQty   = displayItems.reduce((s, i) => s + i.totalQty, 0)
  const totalPKR   = displayItems.reduce((s, i) => s + i.totalPKR, 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {displayItems.length} entr{displayItems.length !== 1 ? 'ies' : 'y'}{hasFilters ? ' (filtered)' : ''}
          </p>
        </div>
        <Button asChild className="min-h-[44px]">
          <Link href="/sales/new"><Plus className="h-4 w-4 mr-2" />New Sale</Link>
        </Button>
      </div>

      <Suspense>
        <SaleFilters customers={customers} lots={lots} />
      </Suspense>

      {displayItems.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            {hasFilters ? 'No sales match your filters.' : 'No sales yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Customer</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Items</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Qty</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Amount (PKR)</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Due</th>
                  <th className="px-4 py-3 w-36" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayItems.map((item) => {
                  const dueDate   = item.paymentDueDate ? new Date(item.paymentDueDate) : null
                  const isOverdue = dueDate && dueDate < new Date()
                  return (
                    <tr key={item.key} className="hover:bg-secondary/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(item.date))}</td>
                      <td className="px-4 py-3 font-medium">{customerMap.get(item.customerId) ?? '—'}</td>
                      <td className="px-4 py-3">
                        {item.type === 'invoice'
                          ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="font-medium">{item.itemCount} items</span>
                              {item.hasAnyBelowCost && (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-label="One or more items below cost" />
                              )}
                              <span className="text-xs text-muted-foreground">({item.stockItemIds.map((id) => lotMap.get(id) ?? '?').join(', ')})</span>
                            </span>
                          )
                          : (
                            <span className="flex items-center gap-1">
                              <span className="text-muted-foreground">{lotMap.get(item.stockItemIds[0]) ?? '—'}</span>
                              {item.hasAnyBelowCost && (
                                <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 text-[11px]" title={`Below cost`}>
                                  <AlertTriangle className="h-3 w-3" />
                                </span>
                              )}
                            </span>
                          )
                        }
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.totalQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPKR(item.totalPKR)}</td>
                      <td className={`px-4 py-3 text-right whitespace-nowrap ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {dueDate ? formatPKTDate(dueDate) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={item.type === 'invoice' ? `/sales/invoice/${item.invoiceId}/print` : `/sales/${item.soloOrder!.id}/print`}>
                            <Button variant="ghost" size="sm" className="min-h-[36px]">Print</Button>
                          </Link>
                          <RoleGate allowedRoles={['owner']}>
                            {item.type === 'solo' && item.soloOrder && (
                              <EditSaleForm
                                sale={{ id: item.soloOrder.id, customerId: item.soloOrder.customer_id, stockItemId: item.soloOrder.stock_item_id, quantity: item.soloOrder.quantity, rate: item.soloOrder.rate, currencyCode: item.soloOrder.currency_code, exchangeRate: item.soloOrder.exchange_rate, date: item.soloOrder.date, paymentDueDate: item.soloOrder.payment_due_date }}
                                customers={customers}
                                lots={lots}
                                costMap={costMap}
                              />
                            )}
                            <DeleteButton
                              description={item.type === 'invoice'
                                ? `Delete this invoice (${item.itemCount} items)? Stock quantities will be restored.`
                                : 'Delete this sale order? Stock quantity will be restored.'}
                              onDelete={item.type === 'invoice'
                                ? deleteSaleInvoiceAction.bind(null, { invoiceId: item.invoiceId! })
                                : deleteSaleAction.bind(null, { id: item.soloOrder!.id })}
                            />
                          </RoleGate>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t-2 bg-muted/30">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold">{totalQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold">{formatPKR(totalPKR)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
