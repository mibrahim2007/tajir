import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateCustomerForm } from './create-customer-form'
import { EditCustomerForm } from './edit-customer-form'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deleteCustomerAction } from '@/app/actions/delete-customer'
import { formatPKR } from '@/lib/utils/currency'

export default async function CustomersPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: allCustomers }, { data: allSales }, { data: allReceipts }, { data: allReturns }, { data: allCreditNotes }, { data: allRefunds }] = await Promise.all([
    admin.from('tajir_customers').select('id, name, opening_balance_pkr_equivalent, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
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
    const openingBalance = parseFloat(c.opening_balance_pkr_equivalent ?? '0')
    const billed = sales
      .filter((s) => s.customer_id === c.id)
      .reduce((sum, s) => sum + parseFloat(s.pkr_equivalent), 0)
    const received = receipts
      .filter((r) => r.customer_id === c.id)
      .reduce((sum, r) => sum + parseFloat(r.pkr_equivalent), 0)
    const returned = returns
      .filter((r) => r.customer_id === c.id)
      .reduce((sum, r) => sum + parseFloat(r.pkr_equivalent), 0)
    const credited = creditNotes
      .filter((n) => n.customer_id === c.id)
      .reduce((sum, n) => sum + parseFloat(n.pkr_equivalent), 0)
    const refunded = refunds
      .filter((r) => r.customer_id === c.id)
      .reduce((sum, r) => sum + parseFloat(r.pkr_equivalent), 0)
    outstandingByCustomer.set(c.id, openingBalance + billed - received - returned - credited + refunded)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">{customers.length} customer{customers.length !== 1 ? 's' : ''}</p>
        </div>
        <CreateCustomerForm />
      </div>

      {customers.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No customers yet. Add your first customer to start tracking receivables.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Outstanding (PKR)</th>
                <th className="px-4 py-3" />
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {customers.map((c) => {
                const outstanding = outstandingByCustomer.get(c.id) ?? 0
                return (
                  <tr key={c.id} className="hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {outstanding < 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Credit</span>
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">{formatPKR(Math.abs(outstanding))}</span>
                        </span>
                      ) : (
                        <span className={outstanding > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
                          {formatPKR(outstanding)}
                        </span>
                      )}
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
                            onDelete={deleteCustomerAction.bind(null, { id: c.id })}
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
