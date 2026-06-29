import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { StockBalanceTable } from './stock-balance-table'
import { CustomerBalanceTable } from './customer-balance-table'
import { SupplierBalanceTable } from './supplier-balance-table'

export default async function OpeningBalancesPage() {
  const { tenantId, role } = await requireAuth()

  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()

  const [{ data: rawLots }, { data: rawCustomers }, { data: rawSuppliers }] = await Promise.all([
    admin.from('inventory_lots').select('id, name, current_quantity, opening_rate').eq('tenant_id', tenantId),
    admin.from('tajir_customers').select('id, name, opening_balance, opening_balance_currency, opening_balance_pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('suppliers').select('id, name, opening_balance, opening_balance_currency, opening_balance_pkr_equivalent').eq('tenant_id', tenantId),
  ])

  const lots = (rawLots ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    currentQuantity: l.current_quantity,
    openingRate: l.opening_rate ?? '0',
  }))

  const customers = (rawCustomers ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    openingBalance: c.opening_balance,
    openingBalanceCurrency: c.opening_balance_currency,
    openingBalancePkrEquivalent: c.opening_balance_pkr_equivalent,
  }))

  const allSuppliers = (rawSuppliers ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    openingBalance: s.opening_balance,
    openingBalanceCurrency: s.opening_balance_currency,
    openingBalancePkrEquivalent: s.opening_balance_pkr_equivalent,
  }))

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Opening Balances</h1>
        <p className="text-sm text-muted-foreground mt-1">Set quantities and outstanding balances to bring your current business state into Tajir. Changes are saved immediately and reflected across all reports.</p>
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
