import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateCreditNoteForm } from './create-credit-note-form'

export default async function NewCreditNotePage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawCustomers }, { data: rawOrders }] = await Promise.all([
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('sales_orders')
      .select('id, date, customer_id, pkr_equivalent, currency_code')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .limit(200),
  ])

  const customerList = rawCustomers ?? []
  const saleOrderList = (rawOrders ?? []).map((o) => ({
    id: o.id,
    date: o.date,
    customerId: o.customer_id,
    pkrEquivalent: o.pkr_equivalent,
    currencyCode: o.currency_code,
  }))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Credit Note</h1>
        <p className="text-sm text-muted-foreground mt-1">Issue a financial credit to a customer — reduces their outstanding balance.</p>
      </div>
      <CreateCreditNoteForm
        today={today}
        customers={customerList}
        saleOrders={saleOrderList}
      />
    </div>
  )
}
