import Link from 'next/link'
import { Suspense } from 'react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { EditPurchaseForm } from './edit-purchase-form'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deletePurchaseAction } from '@/app/actions/delete-purchase'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { PurchaseFilters } from './purchase-filters'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function PurchasesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const filterFrom     = typeof params.from     === 'string' ? params.from     : undefined
  const filterTo       = typeof params.to       === 'string' ? params.to       : undefined
  const filterSupplier = typeof params.supplier === 'string' ? params.supplier : undefined
  const filterItem     = typeof params.item     === 'string' ? params.item     : undefined

  const { tenantId, role } = await requireAuth()
  const admin = createAdminClient()

  let query = admin.from('purchase_orders')
    .select('id, date, quantity, rate, currency_code, exchange_rate, pkr_equivalent, advance_paid, supplier_id, stock_item_id')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })
    .limit(500)

  if (filterFrom)     query = query.gte('date', filterFrom)
  if (filterTo)       query = query.lte('date', filterTo)
  if (filterSupplier) query = query.eq('supplier_id', filterSupplier)
  if (filterItem)     query = query.eq('stock_item_id', filterItem)

  const [{ data: rawOrders }, { data: rawSuppliers }, { data: rawLots }] = await Promise.all([
    query,
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name, count').eq('tenant_id', tenantId).order('name'),
  ])

  const orders      = rawOrders ?? []
  const supplierList = rawSuppliers ?? []
  const lotList      = (rawLots ?? []).map((l) => ({ ...l, count: String(l.count ?? '') }))

  const supplierMap = new Map(supplierList.map((s) => [s.id, s.name]))
  const lotMap      = new Map(lotList.map((l) => [l.id, l.name]))

  const hasFilters = filterFrom || filterTo || filterSupplier || filterItem
  const totalQty   = orders.reduce((s, o) => s + parseFloat(o.quantity), 0)
  const totalPKR   = orders.reduce((s, o) => s + parseFloat(o.pkr_equivalent), 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Purchases</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {orders.length} record{orders.length !== 1 ? 's' : ''}{hasFilters ? ' (filtered)' : ''}
          </p>
        </div>
        <Link href="/purchases/new">
          <Button className="min-h-[44px]">New Purchase</Button>
        </Link>
      </div>

      <Suspense>
        <PurchaseFilters suppliers={supplierList} lots={lotList} />
      </Suspense>

      {orders.length === 0 ? (
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
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Supplier</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Item</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Qty</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Rate</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">PKR Total</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(o.date))}</td>
                    <td className="px-4 py-3">{supplierMap.get(o.supplier_id) ?? '—'}</td>
                    <td className="px-4 py-3">{lotMap.get(o.stock_item_id) ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{parseFloat(o.quantity).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{o.currency_code} {parseFloat(o.rate).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPKR(parseFloat(o.pkr_equivalent))}</td>
                    <td className="px-4 py-3">
                      <RoleGate allowedRoles={['owner']}>
                        <div className="flex items-center gap-1">
                          <EditPurchaseForm
                            purchase={{ id: o.id, supplierId: o.supplier_id, stockItemId: o.stock_item_id, quantity: o.quantity, rate: o.rate, currencyCode: o.currency_code, exchangeRate: o.exchange_rate, advancePaid: o.advance_paid, date: o.date }}
                            suppliers={supplierList}
                            lots={lotList}
                          />
                          <DeleteButton
                            description="Delete this purchase? Stock quantity will be reversed."
                            onDelete={deletePurchaseAction.bind(null, { id: o.id })}
                          />
                        </div>
                      </RoleGate>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-muted/30">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold">{totalQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                  <td />
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
