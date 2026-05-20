import { eq, desc } from 'drizzle-orm'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { db } from '@/db'
import { tajirCustomers, salesOrders, arReceipts } from '@/db/schema'
import { CreateCustomerForm } from './create-customer-form'
import { EditCustomerForm } from './edit-customer-form'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deleteCustomerAction } from '@/app/actions/delete-customer'
import { formatPKR } from '@/lib/utils/currency'

export default async function CustomersPage() {
  const { tenantId } = await requireAuth()

  const allCustomers = await db
    .select()
    .from(tajirCustomers)
    .where(eq(tajirCustomers.tenantId, tenantId))
    .orderBy(desc(tajirCustomers.createdAt))

  const [allSales, allReceipts] = await Promise.all([
    db.select({ customerId: salesOrders.customerId, pkrEquivalent: salesOrders.pkrEquivalent })
      .from(salesOrders).where(eq(salesOrders.tenantId, tenantId)),
    db.select({ customerId: arReceipts.customerId, pkrEquivalent: arReceipts.pkrEquivalent })
      .from(arReceipts).where(eq(arReceipts.tenantId, tenantId)),
  ])

  const outstandingByCustomer = new Map<string, number>()
  for (const c of allCustomers) {
    const openingBalance = parseFloat(c.openingBalancePkrEquivalent)
    const billed = allSales
      .filter((s) => s.customerId === c.id)
      .reduce((sum, s) => sum + parseFloat(s.pkrEquivalent), 0)
    const received = allReceipts
      .filter((r) => r.customerId === c.id)
      .reduce((sum, r) => sum + parseFloat(r.pkrEquivalent), 0)
    outstandingByCustomer.set(c.id, openingBalance + billed - received)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">{allCustomers.length} customer{allCustomers.length !== 1 ? 's' : ''}</p>
        </div>
        <CreateCustomerForm />
      </div>

      {allCustomers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No customers yet. Add your first customer to start tracking receivables.</p>
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
              {allCustomers.map((c) => {
                const outstanding = outstandingByCustomer.get(c.id) ?? 0
                return (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${outstanding > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                      {formatPKR(outstanding)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/customers/${c.id}/ledger`}
                        className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
                      >
                        Ledger
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <RoleGate allowedRoles={['owner']}>
                        <div className="flex gap-1 justify-end">
                          <EditCustomerForm id={c.id} currentName={c.name} />
                          <DeleteButton
                            description={`Delete customer "${c.name}"? All associated sales and receipts will also be deleted.`}
                            onDelete={() => deleteCustomerAction({ id: c.id })}
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
