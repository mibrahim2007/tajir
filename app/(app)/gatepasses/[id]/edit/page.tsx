import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { EditGatepassForm } from './edit-gatepass-form'

export default async function EditGatepassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const { data: gatepass } = await admin
    .from('gatepasses')
    .select('id, gatepass_number, type, date, vehicle_number, driver_name, remarks')
    .eq('id', id).eq('tenant_id', tenantId).single()

  if (!gatepass) notFound()

  const { data: existingItems } = await admin
    .from('gatepass_items')
    .select('id, purchase_order_id, sales_order_id, stock_item_id, quantity')
    .eq('gatepass_id', id)
    .order('created_at')

  const currentItems = existingItems ?? []

  const [
    { data: rawPurchases },
    { data: rawSales },
    { data: rawSuppliers },
    { data: rawCustomers },
    { data: rawLots },
    { data: receivedItems },
    { data: dispatchedItems },
  ] = await Promise.all([
    admin.from('purchase_orders').select('id, date, quantity, supplier_id, stock_item_id')
      .eq('tenant_id', tenantId).order('date', { ascending: false }),
    admin.from('sales_orders').select('id, date, quantity, customer_id, stock_item_id')
      .eq('tenant_id', tenantId).order('date', { ascending: false }),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
    // Exclude current gatepass from received/dispatched calculation
    admin.from('gatepass_items').select('purchase_order_id, quantity')
      .not('purchase_order_id', 'is', null).neq('gatepass_id', id),
    admin.from('gatepass_items').select('sales_order_id, quantity')
      .not('sales_order_id', 'is', null).neq('gatepass_id', id),
  ])

  const supplierMap = new Map((rawSuppliers  ?? []).map(s => [s.id, s.name]))
  const customerMap = new Map((rawCustomers  ?? []).map(c => [c.id, c.name]))
  const lotMap      = new Map((rawLots       ?? []).map(l => [l.id, l.name]))

  const purchaseReceivedMap = new Map<string, number>()
  for (const r of receivedItems ?? []) {
    if (r.purchase_order_id)
      purchaseReceivedMap.set(r.purchase_order_id, (purchaseReceivedMap.get(r.purchase_order_id) ?? 0) + Number(r.quantity ?? 0))
  }

  const saleDispatchedMap = new Map<string, number>()
  for (const r of dispatchedItems ?? []) {
    if (r.sales_order_id)
      saleDispatchedMap.set(r.sales_order_id, (saleDispatchedMap.get(r.sales_order_id) ?? 0) + Number(r.quantity ?? 0))
  }

  const purchaseOrders = (rawPurchases ?? []).map(o => ({
    id:            o.id,
    date:          o.date,
    stockItemId:   o.stock_item_id,
    stockItemName: lotMap.get(o.stock_item_id) ?? '—',
    partyName:     supplierMap.get(o.supplier_id) ?? '—',
    orderQty:      Number(o.quantity),
    balance:       Math.max(0, Number(o.quantity) - (purchaseReceivedMap.get(o.id) ?? 0)),
  }))

  const salesOrders = (rawSales ?? []).map(o => ({
    id:            o.id,
    date:          o.date,
    stockItemId:   o.stock_item_id,
    stockItemName: lotMap.get(o.stock_item_id) ?? '—',
    partyName:     customerMap.get(o.customer_id) ?? '—',
    orderQty:      Number(o.quantity),
    balance:       Math.max(0, Number(o.quantity) - (saleDispatchedMap.get(o.id) ?? 0)),
  }))

  // Pre-fill lines from existing items; ensure orders with current allocation show up
  const existingLines = currentItems.map(item => {
    const orderId = gatepass.type === 'purchase'
      ? (item.purchase_order_id ?? '')
      : (item.sales_order_id ?? '')
    return { orderId, quantity: Number(item.quantity ?? 0) }
  })

  // Ensure orders from existing items appear in the order list (they may have 0 balance
  // from other gatepasses but were allocated to this one — already handled by neq exclusion above)
  const existingOrderIds = new Set(existingLines.map(l => l.orderId))
  const allPurchaseOrders = purchaseOrders.filter(o => o.balance > 0 || existingOrderIds.has(o.id))
  const allSalesOrders    = salesOrders.filter(o => o.balance > 0 || existingOrderIds.has(o.id))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Edit Gatepass <span className="text-muted-foreground font-mono text-lg">{gatepass.gatepass_number}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Update details for this {gatepass.type} gatepass.</p>
      </div>
      <EditGatepassForm
        id={gatepass.id}
        gpNumber={gatepass.gatepass_number ?? ''}
        type={gatepass.type as 'purchase' | 'sale'}
        defaultValues={{
          date:          gatepass.date,
          vehicleNumber: gatepass.vehicle_number ?? '',
          driverName:    gatepass.driver_name ?? '',
          remarks:       gatepass.remarks ?? '',
          lines:         existingLines.length > 0 ? existingLines : [{ orderId: '', quantity: 0 }],
        }}
        purchaseOrders={allPurchaseOrders}
        salesOrders={allSalesOrders}
      />
    </div>
  )
}
