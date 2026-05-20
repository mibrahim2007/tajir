import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { db } from '@/db'
import { inventoryLots, tajirCustomers, suppliers } from '@/db/schema'
import { StockBalanceTable } from './stock-balance-table'
import { CustomerBalanceTable } from './customer-balance-table'
import { SupplierBalanceTable } from './supplier-balance-table'

export default async function OpeningBalancesPage() {
  const { tenantId, role } = await requireAuth()

  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const [lots, customers, allSuppliers] = await Promise.all([
    db.select({ id: inventoryLots.id, name: inventoryLots.name, currentQuantity: inventoryLots.currentQuantity })
      .from(inventoryLots).where(eq(inventoryLots.tenantId, tenantId)),
    db.select({ id: tajirCustomers.id, name: tajirCustomers.name, openingBalance: tajirCustomers.openingBalance, openingBalanceCurrency: tajirCustomers.openingBalanceCurrency, openingBalancePkrEquivalent: tajirCustomers.openingBalancePkrEquivalent })
      .from(tajirCustomers).where(eq(tajirCustomers.tenantId, tenantId)),
    db.select({ id: suppliers.id, name: suppliers.name, openingBalance: suppliers.openingBalance, openingBalanceCurrency: suppliers.openingBalanceCurrency, openingBalancePkrEquivalent: suppliers.openingBalancePkrEquivalent })
      .from(suppliers).where(eq(suppliers.tenantId, tenantId)),
  ])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Opening Balances</h1>
        <p className="text-sm text-muted-foreground">Set quantities and outstanding balances to bring your current business state into Tajir. Changes are saved immediately and reflected across all reports.</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Stock Item Quantities</h2>
        <StockBalanceTable lots={lots} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Customer Opening Balances</h2>
        <CustomerBalanceTable customers={customers} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Supplier Opening Balances</h2>
        <SupplierBalanceTable suppliers={allSuppliers} />
      </section>
    </div>
  )
}
