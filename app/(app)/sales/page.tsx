import Link from 'next/link'
import { Suspense } from 'react'
import { Plus } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { EditSaleForm } from './edit-sale-form'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deleteSaleAction } from '@/app/actions/delete-sale'
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
    .select('id, date, customer_id, stock_item_id, quantity, rate, currency_code, exchange_rate, pkr_equivalent, payment_due_date')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })
    .limit(500)

  if (filterFrom)     query = query.gte('date', filterFrom)
  if (filterTo)       query = query.lte('date', filterTo)
  if (filterCustomer) query = query.eq('customer_id', filterCustomer)
  if (filterItem)     query = query.eq('stock_item_id', filterItem)

  const [{ data: rawOrders }, { data: rawCustomers }, { data: rawLots }] = await Promise.all([
    query,
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId).order('name'),
  ])

  const orders    = rawOrders ?? []
  const customers = rawCustomers ?? []
  const lots      = rawLots ?? []

  const customerMap = new Map(customers.map((c) => [c.id, c.name]))
  const lotMap      = new Map(lots.map((l) => [l.id, l.name]))

  const hasFilters = filterFrom || filterTo || filterCustomer || filterItem
  const totalQty   = orders.reduce((s, o) => s + parseFloat(o.quantity), 0)
  const totalPKR   = orders.reduce((s, o) => s + parseFloat(o.pkr_equivalent), 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {orders.length} order{orders.length !== 1 ? 's' : ''}{hasFilters ? ' (filtered)' : ''}
          </p>
        </div>
        <Button asChild className="min-h-[44px]">
          <Link href="/sales/new"><Plus className="h-4 w-4 mr-2" />New Sale</Link>
        </Button>
      </div>

      <Suspense>
        <SaleFilters customers={customers} lots={lots} />
      </Suspense>

      {orders.length === 0 ? (
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
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Item</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Qty</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Rate</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Amount (PKR)</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Due</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => {
                  const dueDate  = o.payment_due_date ? new Date(o.payment_due_date) : null
                  const isOverdue = dueDate && dueDate < new Date()
                  return (
                    <tr key={o.id} className="hover:bg-secondary/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(o.date))}</td>
                      <td className="px-4 py-3 font-medium">{customerMap.get(o.customer_id) ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{lotMap.get(o.stock_item_id) ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{parseFloat(o.quantity).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{o.currency_code} {parseFloat(o.rate).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPKR(parseFloat(o.pkr_equivalent))}</td>
                      <td className={`px-4 py-3 text-right whitespace-nowrap ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {dueDate ? formatPKTDate(dueDate) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <RoleGate allowedRoles={['owner']}>
                          <div className="flex items-center gap-1">
                            <EditSaleForm
                              sale={{ id: o.id, customerId: o.customer_id, stockItemId: o.stock_item_id, quantity: o.quantity, rate: o.rate, currencyCode: o.currency_code, exchangeRate: o.exchange_rate, date: o.date, paymentDueDate: o.payment_due_date }}
                              customers={customers}
                              lots={lots}
                            />
                            <DeleteButton
                              description="Delete this sale order? Stock quantity will be restored."
                              onDelete={deleteSaleAction.bind(null, { id: o.id })}
                            />
                          </div>
                        </RoleGate>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t-2 bg-muted/30">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold">{totalQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                  <td />
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
