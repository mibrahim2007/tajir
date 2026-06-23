import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deletePurchaseReturnAction } from '@/app/actions/delete-purchase-return'
import { EditPurchaseReturnForm } from './edit-purchase-return-form'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

export default async function PurchaseReturnsPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: rawReturns }, { data: rawSuppliers }, { data: rawLots }] = await Promise.all([
    admin.from('purchase_returns')
      .select('id, date, quantity, rate, currency_code, exchange_rate, pkr_equivalent, supplier_id, stock_item_id, purchase_order_id, reason')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .limit(200),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId).order('name'),
  ])

  const returns = rawReturns ?? []
  const supplierMap = new Map((rawSuppliers ?? []).map((s) => [s.id, s.name]))
  const lotMap = new Map((rawLots ?? []).map((l) => [l.id, l.name]))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Purchase Returns</h1>
          <p className="text-sm text-muted-foreground mt-1">{returns.length} record{returns.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/purchase-returns/new">
          <Button className="min-h-[44px]">New Purchase Return</Button>
        </Link>
      </div>

      {returns.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No purchase returns yet.</p>
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
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Reason</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(r.date))}</td>
                    <td className="px-4 py-3">{supplierMap.get(r.supplier_id) ?? '—'}</td>
                    <td className="px-4 py-3">{lotMap.get(r.stock_item_id) ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.currency_code} {r.rate}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPKR(parseFloat(r.pkr_equivalent))}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{r.reason ?? '—'}</td>
                    <td className="px-4 py-3">
                      <RoleGate allowedRoles={['owner']}>
                        <div className="flex items-center gap-1">
                          <EditPurchaseReturnForm
                            ret={{ id: r.id, supplierId: r.supplier_id, stockItemId: r.stock_item_id, quantity: r.quantity, rate: r.rate, currencyCode: r.currency_code, exchangeRate: r.exchange_rate, date: r.date, reason: r.reason ?? null }}
                            suppliers={rawSuppliers ?? []}
                            lots={rawLots ?? []}
                          />
                          <DeleteButton
                            description="Delete this purchase return? Stock quantity will be restored."
                            onDelete={deletePurchaseReturnAction.bind(null, { id: r.id })}
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
