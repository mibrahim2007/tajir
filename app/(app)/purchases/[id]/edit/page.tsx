import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadPolyesterLotIds } from '@/lib/inventory/polyester-lots'
import { EditPurchaseForm } from '../../edit-purchase-form'

// Quick edit of a single purchase order (a solo order or a one-line invoice).
export default async function EditPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()

  const [{ data: order }, { data: rawSuppliers }, { data: rawLots }, { data: rawLocs }, polyesterLotIds] = await Promise.all([
    admin.from('purchase_orders')
      .select('id, date, quantity, rate, currency_code, exchange_rate, advance_paid, supplier_id, stock_item_id, location_id, nos_carton, weight_per_carton')
      .eq('id', id).eq('tenant_id', tenantId).maybeSingle(),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name, count, unit_of_measure').eq('tenant_id', tenantId).order('name'),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId).order('name'),
    loadPolyesterLotIds(admin, tenantId),
  ])

  if (!order) notFound()

  const lotList = (rawLots ?? []).map((l) => ({ ...l, count: String(l.count ?? ''), unitOfMeasure: l.unit_of_measure ?? null, isPolyester: polyesterLotIds.has(l.id) }))

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit Purchase</h1>
        <p className="text-sm text-muted-foreground mt-1">Update the quantity, rate, advance, date or location of this purchase.</p>
      </div>
      <EditPurchaseForm
        purchase={{ id: order.id, supplierId: order.supplier_id, stockItemId: order.stock_item_id, quantity: order.quantity, rate: order.rate, currencyCode: order.currency_code, exchangeRate: order.exchange_rate, advancePaid: order.advance_paid, date: order.date, locationId: order.location_id, nosCarton: order.nos_carton, weightPerCarton: order.weight_per_carton }}
        suppliers={rawSuppliers ?? []}
        lots={lotList}
        locations={rawLocs ?? []}
      />
    </div>
  )
}
