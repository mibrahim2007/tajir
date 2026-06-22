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
    { data: receivedItems },
    { data: dispatchedItems },
    { count: gpCount },
  ] = await Promise.all([
    admin.from('purchase_orders').select('id, date, quantity, supplier_id, stock_item_id')
      .eq('tenant_id', tenantId).order('date', { ascending: false }),
    admin.from('sales_orders').select('id, date, quantity, customer_id, stock_item_id')
      .eq('tenant_id', tenantId).order('date', { ascending: false }),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
    admin.from('gatepass_items').select('purchase_order_id, quantity').not('purchase_order_id', 'is', null),
    admin.from('gatepass_items').select('sales_order_id, quantity').not('sales_order_id', 'is', null),
    admin.from('gatepasses').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
  ])

  const nextGpNumber = `GP-${String((gpCount ?? 0) + 1).padStart(4, '0')}`

  const supplierMap  = new Map((rawSuppliers  ?? []).map(s => [s.id, s.name]))
  const customerMap  = new Map((rawCustomers  ?? []).map(c => [c.id, c.name]))
  const lotMap       = new Map((rawLots       ?? []).map(l => [l.id, l.name]))

  /* Calculate received qty per purchase order */
  const purchaseReceivedMap = new Map<string, number>()
  for (const r of receivedItems ?? []) {
    if (r.purchase_order_id)
      purchaseReceivedMap.set(r.purchase_order_id, (purchaseReceivedMap.get(r.purchase_order_id) ?? 0) + Number(r.quantity ?? 0))
  }

  /* Calculate dispatched qty per sales order */
  const saleDispatchedMap = new Map<string, number>()
  for (const r of dispatchedItems ?? []) {
    if (r.sales_order_id)
      saleDispatchedMap.set(r.sales_order_id, (saleDispatchedMap.get(r.sales_order_id) ?? 0) + Number(r.quantity ?? 0))
  }

  /* Purchase orders with remaining balance */
  const purchaseOrders = (rawPurchases ?? [])
    .map(o => ({
      id:            o.id,
      date:          o.date,
      stockItemId:   o.stock_item_id,
      stockItemName: lotMap.get(o.stock_item_id) ?? '—',
      partyName:     supplierMap.get(o.supplier_id) ?? '—',
      orderQty:      Number(o.quantity),
      balance:       Math.max(0, Number(o.quantity) - (purchaseReceivedMap.get(o.id) ?? 0)),
    }))
    .filter(o => o.balance > 0)

  /* Sales orders with remaining balance */
  const salesOrders = (rawSales ?? [])
    .map(o => ({
      id:            o.id,
      date:          o.date,
      stockItemId:   o.stock_item_id,
      stockItemName: lotMap.get(o.stock_item_id) ?? '—',
      partyName:     customerMap.get(o.customer_id) ?? '—',
      orderQty:      Number(o.quantity),
      balance:       Math.max(0, Number(o.quantity) - (saleDispatchedMap.get(o.id) ?? 0)),
    }))
    .filter(o => o.balance > 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Gatepass</h1>
        <p className="text-sm text-muted-foreground mt-1">Select orders with pending balance to receive or dispatch.</p>
      </div>
      <CreateGatepassForm
        today={today}
        nextGpNumber={nextGpNumber}
        purchaseOrders={purchaseOrders}
        salesOrders={salesOrders}
      />
    </div>
  )
}
