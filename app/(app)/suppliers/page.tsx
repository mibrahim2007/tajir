import { eq, desc } from 'drizzle-orm'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { db } from '@/db'
import { suppliers, purchaseOrders, apPayments } from '@/db/schema'
import { CreateSupplierForm } from './create-supplier-form'
import { EditSupplierForm } from './edit-supplier-form'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deleteSupplierAction } from '@/app/actions/delete-supplier'
import { formatPKR } from '@/lib/utils/currency'

export default async function SuppliersPage() {
  const { tenantId } = await requireAuth()

  const allSuppliers = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.tenantId, tenantId))
    .orderBy(desc(suppliers.createdAt))

  const [allPurchases, allPayments] = await Promise.all([
    db.select({ supplierId: purchaseOrders.supplierId, pkrEquivalent: purchaseOrders.pkrEquivalent, advancePaid: purchaseOrders.advancePaid })
      .from(purchaseOrders).where(eq(purchaseOrders.tenantId, tenantId)),
    db.select({ supplierId: apPayments.supplierId, pkrEquivalent: apPayments.pkrEquivalent })
      .from(apPayments).where(eq(apPayments.tenantId, tenantId)),
  ])

  const outstandingBySupplier = new Map<string, number>()
  for (const s of allSuppliers) {
    const openingBalance = parseFloat(s.openingBalancePkrEquivalent)
    const purchased = allPurchases
      .filter((p) => p.supplierId === s.id)
      .reduce((sum, p) => sum + parseFloat(p.pkrEquivalent) - parseFloat(p.advancePaid), 0)
    const paid = allPayments
      .filter((p) => p.supplierId === s.id)
      .reduce((sum, p) => sum + parseFloat(p.pkrEquivalent), 0)
    outstandingBySupplier.set(s.id, openingBalance + purchased - paid)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-1">{allSuppliers.length} supplier{allSuppliers.length !== 1 ? 's' : ''}</p>
        </div>
        <CreateSupplierForm />
      </div>

      {allSuppliers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No suppliers yet. Add your first supplier to start tracking payables.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-right px-4 py-3 font-medium">Outstanding (PKR)</th>
                <th className="px-4 py-3" />
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {allSuppliers.map((s) => {
                const outstanding = outstandingBySupplier.get(s.id) ?? 0
                return (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${outstanding > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {formatPKR(outstanding)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/suppliers/${s.id}/ledger`}
                        className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
                      >
                        Ledger
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <RoleGate allowedRoles={['owner']}>
                        <div className="flex gap-1 justify-end">
                          <EditSupplierForm id={s.id} currentName={s.name} />
                          <DeleteButton
                            description={`Delete supplier "${s.name}"? This cannot be undone.`}
                            onDelete={() => deleteSupplierAction({ id: s.id })}
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
      )}
    </div>
  )
}
