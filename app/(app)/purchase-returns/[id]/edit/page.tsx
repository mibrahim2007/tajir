import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadYarnLotIds } from '@/lib/inventory/yarn-lots'
import { EditPurchaseReturnForm } from '../../edit-purchase-return-form'

export default async function EditPurchaseReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()

  const [{ data: r }, { data: rawSuppliers }, { data: rawLots }, { data: rawLocs }, yarnLotIds] = await Promise.all([
    admin.from('purchase_returns')
      .select('id, date, quantity, rate, currency_code, exchange_rate, supplier_id, stock_item_id, reason, location_id, yarn_type, yarn_weight, multiply_by')
      .eq('id', id).eq('tenant_id', tenantId).maybeSingle(),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name, unit_of_measure').eq('tenant_id', tenantId).order('name'),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId).order('name'),
    loadYarnLotIds(admin, tenantId),
  ])

  if (!r) notFound()

  const lotList = (rawLots ?? []).map((l) => ({ id: l.id, name: l.name, unitOfMeasure: l.unit_of_measure ?? null, isYarn: yarnLotIds.has(l.id) }))

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit Purchase Return</h1>
        <p className="text-sm text-muted-foreground mt-1">Update the goods returned to a supplier.</p>
      </div>
      <EditPurchaseReturnForm
        ret={{ id: r.id, supplierId: r.supplier_id, stockItemId: r.stock_item_id, quantity: r.quantity, rate: r.rate, currencyCode: r.currency_code, exchangeRate: r.exchange_rate, date: r.date, reason: r.reason ?? null, locationId: r.location_id ?? null, yarnType: r.yarn_type ?? null, yarnWeight: r.yarn_weight ?? null, multiplyBy: r.multiply_by ?? null }}
        suppliers={rawSuppliers ?? []}
        lots={lotList}
        locations={rawLocs ?? []}
      />
    </div>
  )
}
