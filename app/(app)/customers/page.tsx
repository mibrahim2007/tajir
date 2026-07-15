import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateCustomerForm } from './create-customer-form'
import { CustomersList } from './customers-list'
import { CustomerGuide } from './customer-guide'

export default async function CustomersPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: allCustomers }, { data: allSales }, { data: allReceipts }, { data: allReturns }, { data: allCreditNotes }, { data: allRefunds }] = await Promise.all([
    admin.from('tajir_customers').select('id, name, status, opening_balance_pkr_equivalent, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    admin.from('sales_orders').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('ar_receipts').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('sale_returns').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('credit_notes').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('customer_refunds').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId),
  ])

  const customers = allCustomers ?? []
  const sales = allSales ?? []
  const receipts = allReceipts ?? []
  const returns = allReturns ?? []
  const creditNotes = allCreditNotes ?? []
  const refunds = allRefunds ?? []

  const outstandingByCustomer = new Map<string, number>()
  for (const c of customers) {
    const openingBalance = c.opening_balance_pkr_equivalent  ?? 0
    const billed = sales
      .filter((s) => s.customer_id === c.id)
      .reduce((sum, s) => sum + s.pkr_equivalent, 0)
    const received = receipts
      .filter((r) => r.customer_id === c.id)
      .reduce((sum, r) => sum + r.pkr_equivalent, 0)
    const returned = returns
      .filter((r) => r.customer_id === c.id)
      .reduce((sum, r) => sum + r.pkr_equivalent, 0)
    const credited = creditNotes
      .filter((n) => n.customer_id === c.id)
      .reduce((sum, n) => sum + n.pkr_equivalent, 0)
    const refunded = refunds
      .filter((r) => r.customer_id === c.id)
      .reduce((sum, r) => sum + r.pkr_equivalent, 0)
    outstandingByCustomer.set(c.id, openingBalance + billed - received - returned - credited + refunded)
  }

  const customerItems = customers.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    outstanding: outstandingByCustomer.get(c.id) ?? 0,
  }))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">{customers.length} customer{customers.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <CustomerGuide />
          <CreateCustomerForm />
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No customers yet. Add your first customer to start tracking receivables.</p>
        </div>
      ) : (
        <CustomersList customers={customerItems} />
      )}
    </div>
  )
}
