import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { EditPurchaseForm } from './edit-purchase-form'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deletePurchaseAction } from '@/app/actions/delete-purchase'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

export default async function PurchasesPage() {
  const { tenantId, role } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: rawOrders }, { data: rawSuppliers }, { data: rawLots }] = await Promise.all([
    admin.from('purchase_orders')
      .select('id, date, quantity, rate, currency_code, exchange_rate, pkr_equivalent, advance_paid, supplier_id, stock_item_id')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .limit(100),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name, count').eq('tenant_id', tenantId),
  ])

  const orders = rawOrders ?? []
  const supplierList = rawSuppliers ?? []
  const lotList = (rawLots ?? []).map((l) => ({ ...l, count: String(l.count ?? '') }))

  const supplierMap = new Map(supplierList.map((s) => [s.id, s.name]))
  const lotMap = new Map(lotList.map((l) => [l.id, l.name]))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Purchases</h1>
          <p className="text-sm text-muted-foreground mt-1">{orders.length} record{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/purchases/new">
          <Button className="min-h-[44px]">New Purchase</Button>
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No purchases yet.</p>
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
                    <td className="px-4 py-3 text-right tabular-nums">{o.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{o.currency_code} {o.rate}</td>
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
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
