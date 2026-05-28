import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateSaleReturnForm } from './create-sale-return-form'

export default async function NewSaleReturnPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawCustomers }, { data: rawLots }, { data: rawOrders }] = await Promise.all([
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name, count').eq('tenant_id', tenantId).order('name'),
    admin.from('sales_orders')
      .select('id, date, customer_id, stock_item_id, quantity, rate, currency_code')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .limit(200),
  ])

  const customerList = rawCustomers ?? []
  const lotList = (rawLots ?? []).map((l) => ({ ...l, count: String(l.count ?? '') }))
  const saleOrderList = (rawOrders ?? []).map((o) => ({
    id: o.id,
    date: o.date,
    customerId: o.customer_id,
    stockItemId: o.stock_item_id,
    quantity: o.quantity,
    rate: o.rate,
    currencyCode: o.currency_code,
  }))

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-1">New Sale Return</h1>
      <p className="text-sm text-muted-foreground mb-6">Record goods returned by a customer. Stock will be incremented.</p>
      <CreateSaleReturnForm
        today={today}
        customers={customerList}
        lots={lotList}
        saleOrders={saleOrderList}
      />
    </div>
  )
}
