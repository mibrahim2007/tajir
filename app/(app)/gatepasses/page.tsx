import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { formatPKTDate } from '@/lib/utils/dates'

export default async function GatepassesPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [
    { data: rawGatepasses },
    { data: rawPurchases },
    { data: rawSales },
    { data: rawSuppliers },
    { data: rawCustomers },
    { data: rawLots },
  ] = await Promise.all([
    admin.from('gatepasses')
      .select('id, type, date, entry_date, vehicle_number, driver_name, remarks, purchase_order_id, sales_order_id')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .limit(100),
    admin.from('purchase_orders').select('id, supplier_id, stock_item_id, quantity').eq('tenant_id', tenantId),
    admin.from('sales_orders').select('id, customer_id, stock_item_id, quantity').eq('tenant_id', tenantId),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
  ])

  const gatepasses    = rawGatepasses ?? []
  const supplierMap   = new Map((rawSuppliers ?? []).map((s) => [s.id, s.name]))
  const customerMap   = new Map((rawCustomers ?? []).map((c) => [c.id, c.name]))
  const lotMap        = new Map((rawLots ?? []).map((l) => [l.id, l.name]))
  const purchaseMap   = new Map((rawPurchases ?? []).map((o) => [o.id, o]))
  const salesMap      = new Map((rawSales ?? []).map((o) => [o.id, o]))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Gatepasses</h1>
          <p className="text-sm text-muted-foreground mt-1">{gatepasses.length} record{gatepasses.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/gatepasses/new">
          <Button className="min-h-[44px]">New Gatepass</Button>
        </Link>
      </div>

      {gatepasses.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No gatepasses yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Gatepass Date</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Party</th>
                  <th className="text-left px-4 py-3 font-medium">Item</th>
                  <th className="text-right px-4 py-3 font-medium">Qty</th>
                  <th className="text-left px-4 py-3 font-medium">Entry Date</th>
                  <th className="text-left px-4 py-3 font-medium">Vehicle</th>
                  <th className="text-left px-4 py-3 font-medium">Driver</th>
                  <th className="text-left px-4 py-3 font-medium">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {gatepasses.map((g) => {
                  let partyName = '—'
                  let itemName  = '—'
                  let qty       = '—'

                  if (g.type === 'purchase' && g.purchase_order_id) {
                    const po = purchaseMap.get(g.purchase_order_id)
                    if (po) {
                      partyName = supplierMap.get(po.supplier_id) ?? '—'
                      itemName  = lotMap.get(po.stock_item_id) ?? '—'
                      qty       = String(po.quantity)
                    }
                  } else if (g.type === 'sale' && g.sales_order_id) {
                    const so = salesMap.get(g.sales_order_id)
                    if (so) {
                      partyName = customerMap.get(so.customer_id) ?? '—'
                      itemName  = lotMap.get(so.stock_item_id) ?? '—'
                      qty       = String(so.quantity)
                    }
                  }

                  return (
                    <tr key={g.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(g.date))}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          g.type === 'purchase'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {g.type === 'purchase' ? 'Purchase' : 'Sale'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{partyName}</td>
                      <td className="px-4 py-3">{itemName}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{qty}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(g.entry_date))}</td>
                      <td className="px-4 py-3">{g.vehicle_number}</td>
                      <td className="px-4 py-3">{g.driver_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{g.remarks ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
