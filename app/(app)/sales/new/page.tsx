import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateSaleForm } from './create-sale-form'

export default async function NewSalePage() {
  const { tenantId, role } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: rawCustomers }, { data: rawSuppliers }, { data: rawItems }, { data: rawRules }, { data: rawLocs }, { data: rawLocStock }, { data: rawPurchases }, { data: rawSales }, { data: rawReceipts }, { data: rawReturns }, { data: rawCreditNotes }, { data: rawRefunds }] = await Promise.all([
    admin.from('tajir_customers').select('id, name, opening_balance_pkr_equivalent').eq('tenant_id', tenantId).order('name'),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name, current_quantity, code, unit_of_measure, item_nature').eq('tenant_id', tenantId).order('name'),
    admin.from('customer_price_lists').select('customer_id, stock_item_id, rate').eq('tenant_id', tenantId),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('location_stock_summary').select('stock_item_id, location_id, quantity').eq('tenant_id', tenantId),
    admin.from('purchase_orders').select('stock_item_id, pkr_equivalent, quantity').eq('tenant_id', tenantId).order('date', { ascending: false }).order('created_at', { ascending: false }),
    admin.from('sales_orders').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('ar_receipts').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('sale_returns').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('credit_notes').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('customer_refunds').select('customer_id, pkr_equivalent').eq('tenant_id', tenantId),
  ])

  // Latest PKR cost per unit for each stock item (first row per item = most recent purchase)
  const costMap: Record<string, number> = {}
  for (const p of rawPurchases ?? []) {
    if (!costMap[p.stock_item_id]) {
      costMap[p.stock_item_id] = p.pkr_equivalent / p.quantity
    }
  }

  // Pre-compute per-customer balance (positive = owes us, negative = we owe them)
  // This is the initial value shown immediately; the form will refresh it live on customer select.
  const customerBalanceMap: Record<string, number> = {}
  for (const c of rawCustomers ?? []) {
    const ob       = c.opening_balance_pkr_equivalent  ?? 0
    const billed   = (rawSales       ?? []).filter((s) => s.customer_id === c.id).reduce((s, r) => s + r.pkr_equivalent, 0)
    const paid     = (rawReceipts    ?? []).filter((r) => r.customer_id === c.id).reduce((s, r) => s + r.pkr_equivalent, 0)
    const ret      = (rawReturns     ?? []).filter((r) => r.customer_id === c.id).reduce((s, r) => s + r.pkr_equivalent, 0)
    const cn       = (rawCreditNotes ?? []).filter((n) => n.customer_id === c.id).reduce((s, n) => s + n.pkr_equivalent, 0)
    const refunded = (rawRefunds     ?? []).filter((r) => r.customer_id === c.id).reduce((s, r) => s + r.pkr_equivalent, 0)
    customerBalanceMap[c.id] = ob + billed - paid - ret - cn + refunded
  }

  const customers = (rawCustomers ?? []).map((c) => ({ id: c.id, name: c.name }))
  const suppliers = (rawSuppliers ?? []).map((s) => ({ id: s.id, name: s.name }))
  const stockItems = (rawItems ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    currentQuantity: l.current_quantity,
    barcode: l.code ?? null,
    unitOfMeasure: l.unit_of_measure ?? null,
    itemNature: (l.item_nature === 'service' ? 'service' : 'inventory') as 'inventory' | 'service',
  }))
  const pricingRules = (rawRules ?? []).map((r) => ({
    customerId: r.customer_id,
    stockItemId: r.stock_item_id,
    rate: r.rate,
  }))
  const locations = rawLocs ?? []
  const locationStock = (rawLocStock ?? []).map((ls) => ({
    stockItemId: ls.stock_item_id ?? '',
    locationId: ls.location_id ?? '',
    quantity: parseFloat(String(ls.quantity ?? '0')),
  }))

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Sale</h1>
        <p className="text-sm text-muted-foreground mt-1">Record a sale to a customer.</p>
      </div>
      <CreateSaleForm
        today={today}
        customers={customers}
        suppliers={suppliers}
        stockItems={stockItems}
        pricingRules={pricingRules}
        isOwner={role === 'owner'}
        locations={locations}
        locationStock={locationStock}
        costMap={costMap}
        customerBalanceMap={customerBalanceMap}
      />
    </div>
  )
}
