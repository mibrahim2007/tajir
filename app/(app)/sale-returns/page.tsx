import Link from 'next/link'
import { Suspense } from 'react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deleteSaleReturnAction } from '@/app/actions/delete-sale-return'
import { EditSaleReturnForm } from './edit-sale-return-form'
import { SaleReturnFilters } from './sale-return-filters'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function SaleReturnsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const filterFrom     = typeof params.from     === 'string' ? params.from     : undefined
  const filterTo       = typeof params.to       === 'string' ? params.to       : undefined
  const filterCustomer = typeof params.customer === 'string' ? params.customer : undefined
  const filterItem     = typeof params.item     === 'string' ? params.item     : undefined
  const filterLocation = typeof params.location === 'string' ? params.location : undefined

  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  let query = admin.from('sale_returns')
    .select('id, serial_number, date, quantity, rate, currency_code, exchange_rate, pkr_equivalent, customer_id, stock_item_id, sale_order_id, reason, location_id')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })
    .limit(200)

  if (filterFrom)     query = query.gte('date', filterFrom)
  if (filterTo)       query = query.lte('date', filterTo)
  if (filterCustomer) query = query.eq('customer_id', filterCustomer)
  if (filterItem)     query = query.eq('stock_item_id', filterItem)
  if (filterLocation) query = query.eq('location_id', filterLocation)

  const [{ data: rawReturns }, { data: rawCustomers }, { data: rawLots }, { data: rawLocs }] = await Promise.all([
    query,
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name, unit_of_measure').eq('tenant_id', tenantId).order('name'),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId).order('name'),
  ])

  const returns = rawReturns ?? []
  const customerList = rawCustomers ?? []
  const customerMap = new Map(customerList.map((c) => [c.id, c.name]))
  const lotList = (rawLots ?? []).map((l) => ({ id: l.id, name: l.name, unitOfMeasure: l.unit_of_measure ?? null }))
  const lotMap = new Map(lotList.map((l) => [l.id, l.name]))
  const locationList = rawLocs ?? []
  const locationMap = new Map(locationList.map((l) => [l.id, l.name]))

  const hasFilters = filterFrom || filterTo || filterCustomer || filterItem || filterLocation

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Sale Returns</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {returns.length} record{returns.length !== 1 ? 's' : ''}{hasFilters ? ' (filtered)' : ''}
          </p>
        </div>
        <Link href="/sale-returns/new">
          <Button className="min-h-[44px]">New Sale Return</Button>
        </Link>
      </div>

      <Suspense>
        <SaleReturnFilters customers={customerList} lots={lotList} locations={locationList} />
      </Suspense>

      {returns.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            {hasFilters ? 'No sale returns match your filters.' : 'No sale returns yet.'}
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
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Customer</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Item</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Qty</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Rate</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">PKR Total</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Location</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Reason</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-medium tabular-nums">{r.serial_number ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(r.date))}</td>
                    <td className="px-4 py-3">{customerMap.get(r.customer_id) ?? '—'}</td>
                    <td className="px-4 py-3">{lotMap.get(r.stock_item_id) ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.currency_code} {r.rate}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPKR(r.pkr_equivalent)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{r.location_id ? locationMap.get(r.location_id) ?? '—' : '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{r.reason ?? '—'}</td>
                    <td className="px-4 py-3">
                      <RoleGate allowedRoles={['owner']}>
                        <div className="flex items-center gap-1">
                          <EditSaleReturnForm
                            ret={{ id: r.id, customerId: r.customer_id, stockItemId: r.stock_item_id, quantity: r.quantity, rate: r.rate, currencyCode: r.currency_code, exchangeRate: r.exchange_rate, date: r.date, reason: r.reason ?? null, locationId: r.location_id ?? null }}
                            customers={customerList}
                            lots={lotList}
                            locations={locationList}
                          />
                          <DeleteButton
                            description="Delete this sale return? Stock quantity will be reversed."
                            onDelete={deleteSaleReturnAction.bind(null, { id: r.id })}
                          />
                        </div>
                      </RoleGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
