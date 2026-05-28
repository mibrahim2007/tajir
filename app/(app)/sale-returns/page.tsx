import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deleteSaleReturnAction } from '@/app/actions/delete-sale-return'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

export default async function SaleReturnsPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: rawReturns }, { data: rawCustomers }, { data: rawLots }] = await Promise.all([
    admin.from('sale_returns')
      .select('id, date, quantity, rate, currency_code, pkr_equivalent, customer_id, stock_item_id, sale_order_id, reason')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .limit(200),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
  ])

  const returns = rawReturns ?? []
  const customerMap = new Map((rawCustomers ?? []).map((c) => [c.id, c.name]))
  const lotMap = new Map((rawLots ?? []).map((l) => [l.id, l.name]))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Sale Returns</h1>
          <p className="text-sm text-muted-foreground mt-1">{returns.length} record{returns.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/sale-returns/new">
          <Button className="min-h-[44px]">New Sale Return</Button>
        </Link>
      </div>

      {returns.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No sale returns yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
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
                    <td className="px-4 py-3">{customerMap.get(r.customer_id) ?? '—'}</td>
                    <td className="px-4 py-3">{lotMap.get(r.stock_item_id) ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.currency_code} {r.rate}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPKR(parseFloat(r.pkr_equivalent))}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{r.reason ?? '—'}</td>
                    <td className="px-4 py-3">
                      <RoleGate allowedRoles={['owner']}>
                        <DeleteButton
                          description="Delete this sale return? Stock quantity will be reversed."
                          onDelete={deleteSaleReturnAction.bind(null, { id: r.id })}
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
