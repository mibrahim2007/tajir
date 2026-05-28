import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreatePurchaseReturnForm } from './create-purchase-return-form'

export default async function NewPurchaseReturnPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawSuppliers }, { data: rawLots }, { data: rawOrders }] = await Promise.all([
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name, count').eq('tenant_id', tenantId).order('name'),
    admin.from('purchase_orders')
      .select('id, date, supplier_id, stock_item_id, quantity, rate, currency_code')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .limit(200),
  ])

  const supplierList = rawSuppliers ?? []
  const lotList = (rawLots ?? []).map((l) => ({ ...l, count: String(l.count ?? '') }))
  const purchaseOrderList = (rawOrders ?? []).map((o) => ({
    id: o.id,
    date: o.date,
    supplierId: o.supplier_id,
    stockItemId: o.stock_item_id,
    quantity: o.quantity,
    rate: o.rate,
    currencyCode: o.currency_code,
  }))

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-1">New Purchase Return</h1>
      <p className="text-sm text-muted-foreground mb-6">Return goods to a supplier. Stock will be decremented.</p>
      <CreatePurchaseReturnForm
        today={today}
        suppliers={supplierList}
        lots={lotList}
        purchaseOrders={purchaseOrderList}
      />
    </div>
  )
}
