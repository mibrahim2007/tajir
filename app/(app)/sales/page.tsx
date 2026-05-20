import { eq, desc } from 'drizzle-orm'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { db } from '@/db'
import { salesOrders, tajirCustomers, inventoryLots } from '@/db/schema'
import { Button } from '@/components/ui/button'
import { EditSaleForm } from './edit-sale-form'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deleteSaleAction } from '@/app/actions/delete-sale'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

export default async function SalesPage() {
  const { tenantId } = await requireAuth()

  const [orders, customers, lots] = await Promise.all([
    db.select().from(salesOrders)
      .where(eq(salesOrders.tenantId, tenantId))
      .orderBy(desc(salesOrders.date)),
    db.select({ id: tajirCustomers.id, name: tajirCustomers.name }).from(tajirCustomers)
      .where(eq(tajirCustomers.tenantId, tenantId)),
    db.select({ id: inventoryLots.id, name: inventoryLots.name }).from(inventoryLots)
      .where(eq(inventoryLots.tenantId, tenantId)),
  ])

  const customerMap = new Map(customers.map((c) => [c.id, c.name]))
  const lotMap = new Map(lots.map((l) => [l.id, l.name]))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Sales</h1>
          <p className="text-sm text-muted-foreground mt-1">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <Button asChild className="min-h-[44px]">
          <Link href="/sales/new"><Plus className="h-4 w-4 mr-2" />New Sale</Link>
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No sales yet.</p>
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
                  <th className="text-right px-4 py-3 font-medium">Amount (PKR)</th>
                  <th className="text-right px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => {
                  const dueDate = o.paymentDueDate ? new Date(o.paymentDueDate) : null
                  const isOverdue = dueDate && dueDate < new Date()
                  return (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(o.date))}</td>
                      <td className="px-4 py-3 font-medium">{customerMap.get(o.customerId) ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{lotMap.get(o.stockItemId) ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{parseFloat(o.quantity).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{o.currencyCode} {parseFloat(o.rate).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPKR(parseFloat(o.pkrEquivalent))}</td>
                      <td className={`px-4 py-3 text-right whitespace-nowrap ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {dueDate ? formatPKTDate(dueDate) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <RoleGate allowedRoles={['owner']}>
                          <div className="flex items-center gap-1">
                            <EditSaleForm
                              sale={o}
                              customers={customers}
                              lots={lots}
                            />
                            <DeleteButton
                              description="Delete this sale order? Stock quantity will be restored."
                              onDelete={() => deleteSaleAction({ id: o.id })}
                            />
                          </div>
                        </RoleGate>
                      </td>
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
