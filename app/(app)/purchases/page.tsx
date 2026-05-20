import { and, eq, desc } from 'drizzle-orm'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { db } from '@/db'
import { purchaseOrders, suppliers, inventoryLots } from '@/db/schema'
import { Button } from '@/components/ui/button'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deletePurchaseAction } from '@/app/actions/delete-purchase'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

export default async function PurchasesPage() {
  const { tenantId } = await requireAuth()

  const orders = await db
    .select({
      id: purchaseOrders.id,
      date: purchaseOrders.date,
      quantity: purchaseOrders.quantity,
      rate: purchaseOrders.rate,
      currencyCode: purchaseOrders.currencyCode,
      pkrEquivalent: purchaseOrders.pkrEquivalent,
      advancePaid: purchaseOrders.advancePaid,
      supplierName: suppliers.name,
      stockItemName: inventoryLots.name,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, and(eq(suppliers.id, purchaseOrders.supplierId), eq(suppliers.tenantId, tenantId)))
    .innerJoin(inventoryLots, and(eq(inventoryLots.id, purchaseOrders.stockItemId), eq(inventoryLots.tenantId, tenantId)))
    .where(eq(purchaseOrders.tenantId, tenantId))
    .orderBy(desc(purchaseOrders.date))
    .limit(100)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Purchases</h1>
          <p className="text-sm text-muted-foreground mt-1">{orders.length} record{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/purchases/new">
          <Button className="min-h-[44px]">New Purchase</Button>
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No purchases yet.</p>
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
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(o.date))}</td>
                    <td className="px-4 py-3">{o.supplierName}</td>
                    <td className="px-4 py-3">{o.stockItemName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{o.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{o.currencyCode} {o.rate}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPKR(parseFloat(o.pkrEquivalent))}</td>
                    <td className="px-4 py-3">
                      <RoleGate allowedRoles={['owner']}>
                        <DeleteButton
                          description="Delete this purchase? Stock quantity will be reversed."
                          onDelete={() => deletePurchaseAction({ id: o.id })}
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
