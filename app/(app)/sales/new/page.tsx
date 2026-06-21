import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateSaleForm } from './create-sale-form'

export default async function NewSalePage() {
  const { tenantId, role } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: rawCustomers }, { data: rawItems }, { data: rawRules }, { data: rawLocs }, { data: rawLocStock }] = await Promise.all([
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name, current_quantity, code').eq('tenant_id', tenantId),
    admin.from('customer_price_lists').select('customer_id, stock_item_id, rate').eq('tenant_id', tenantId),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('location_stock_summary').select('stock_item_id, location_id, quantity').eq('tenant_id', tenantId),
  ])

  const customers = rawCustomers ?? []
  const stockItems = (rawItems ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    currentQuantity: l.current_quantity,
    barcode: l.code ?? null,
  }))
  const pricingRules = (rawRules ?? []).map((r) => ({
    customerId: r.customer_id,
    stockItemId: r.stock_item_id,
    rate: r.rate,
  }))
  const locations = rawLocs ?? []
  const locationStock = (rawLocStock ?? []).map((ls) => ({
    stockItemId: ls.stock_item_id,
    locationId: ls.location_id,
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
        stockItems={stockItems}
        pricingRules={pricingRules}
        isOwner={role === 'owner'}
        locations={locations}
        locationStock={locationStock}
      />
    </div>
  )
}
