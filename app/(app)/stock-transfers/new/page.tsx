import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateStockTransferForm } from './create-stock-transfer-form'

export default async function NewStockTransferPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: locs }, { data: items }, { data: rawLocStock }] = await Promise.all([
    admin.from('locations').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name, count').eq('tenant_id', tenantId).order('name'),
    admin.from('location_stock_summary').select('stock_item_id, location_id, quantity').eq('tenant_id', tenantId),
  ])

  const locationStock = (rawLocStock ?? []).map((ls) => ({
    stockItemId: ls.stock_item_id ?? '',
    locationId: ls.location_id ?? '',
    quantity: parseFloat(String(ls.quantity ?? '0')),
  }))

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Stock Transfer</h1>
        <p className="text-sm text-muted-foreground mt-1">Move stock from one location to another.</p>
      </div>
      <CreateStockTransferForm
        today={today}
        locations={(locs ?? []).map(l => ({ id: l.id, name: l.name }))}
        items={(items ?? []).map(i => ({ id: i.id, name: i.name, count: String(i.count ?? '') }))}
        locationStock={locationStock}
      />
    </div>
  )
}
