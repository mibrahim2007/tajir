import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deletePurchaseReturnAction } from '@/app/actions/delete-purchase-return'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

export default async function PurchaseReturnsPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: rawReturns }, { data: rawSuppliers }, { data: rawLots }] = await Promise.all([
    admin.from('purchase_returns')
      .select('id, date, quantity, rate, currency_code, pkr_equivalent, supplier_id, stock_item_id, purchase_order_id, reason')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .limit(200),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
  ])

  const returns = rawReturns ?? []
  const supplierMap = new Map((rawSuppliers ?? []).map((s) => [s.id, s.name]))
  const lotMap = new Map((rawLots ?? []).map((l) => [l.id, l.name]))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Purchase Returns</h1>
          <p className="text-sm text-muted-foreground mt-1">{returns.length} record{returns.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/purchase-returns/new">
          <Button className="min-h-[44px]">New Purchase Return</Button>
        </Link>
      </div>

      {returns.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No purchase returns yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Supplier</th>
                  <th className="text-left px-4 py-3 font-medium">Item</th>
                  <th className="text-right px-4 py-3 font-medium">Qty</th>
                  <th className="text-right px-4 py-3 font-medium">Rate</th>
                  <th className="text-right px-4 py-3 font-medium">PKR Total</th>
                  <th className="text-left px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(r.date))}</td>
                    <td className="px-4 py-3">{supplierMap.get(r.supplier_id) ?? '—'}</td>
                    <td className="px-4 py-3">{lotMap.get(r.stock_item_id) ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.currency_code} {r.rate}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPKR(parseFloat(r.pkr_equivalent))}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{r.reason ?? '—'}</td>
                    <td className="px-4 py-3">
                      <RoleGate allowedRoles={['owner']}>
                        <DeleteButton
                          description="Delete this purchase return? Stock quantity will be restored."
                          onDelete={deletePurchaseReturnAction.bind(null, { id: r.id })}
                        />
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
