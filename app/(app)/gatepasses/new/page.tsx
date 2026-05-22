import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateGatepassForm } from './create-gatepass-form'

export default async function NewGatepassPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    { data: rawPurchases },
    { data: rawSales },
    { data: rawSuppliers },
    { data: rawCustomers },
    { data: rawLots },
  ] = await Promise.all([
    admin.from('purchase_orders')
      .select('id, date, quantity, supplier_id, stock_item_id')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .limit(200),
    admin.from('sales_orders')
      .select('id, date, quantity, customer_id, stock_item_id')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .limit(200),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
  ])

  const supplierMap = new Map((rawSuppliers ?? []).map((s) => [s.id, s.name]))
  const customerMap = new Map((rawCustomers ?? []).map((c) => [c.id, c.name]))
  const lotMap     = new Map((rawLots ?? []).map((l) => [l.id, l.name]))

  const purchaseOrders = (rawPurchases ?? []).map((o) => ({
    id:            o.id,
    supplierName:  supplierMap.get(o.supplier_id) ?? '—',
    stockItemName: lotMap.get(o.stock_item_id) ?? '—',
    quantity:      String(o.quantity),
    date:          o.date,
  }))

  const salesOrders = (rawSales ?? []).map((o) => ({
    id:            o.id,
    customerName:  customerMap.get(o.customer_id) ?? '—',
    stockItemName: lotMap.get(o.stock_item_id) ?? '—',
    quantity:      String(o.quantity),
    date:          o.date,
  }))

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-1">New Gatepass</h1>
      <p className="text-sm text-muted-foreground mb-6">Issue a gatepass linked to a purchase or sale entry.</p>
      <CreateGatepassForm today={today} purchaseOrders={purchaseOrders} salesOrders={salesOrders} />
    </div>
  )
}
