import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadYarnLotIds } from '@/lib/inventory/yarn-lots'
import { EditSaleReturnForm } from '../../edit-sale-return-form'

export default async function EditSaleReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()

  const [{ data: r }, { data: rawCustomers }, { data: rawLots }, { data: rawLocs }, yarnLotIds] = await Promise.all([
    admin.from('sale_returns')
      .select('id, date, quantity, rate, currency_code, exchange_rate, customer_id, stock_item_id, reason, location_id, yarn_type, yarn_weight, multiply_by')
      .eq('id', id).eq('tenant_id', tenantId).maybeSingle(),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name, unit_of_measure').eq('tenant_id', tenantId).order('name'),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId).order('name'),
    loadYarnLotIds(admin, tenantId),
  ])

  if (!r) notFound()

  const lotList = (rawLots ?? []).map((l) => ({ id: l.id, name: l.name, unitOfMeasure: l.unit_of_measure ?? null, isYarn: yarnLotIds.has(l.id) }))

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit Sale Return</h1>
        <p className="text-sm text-muted-foreground mt-1">Update the goods a customer returned.</p>
      </div>
      <EditSaleReturnForm
        ret={{ id: r.id, customerId: r.customer_id, stockItemId: r.stock_item_id, quantity: r.quantity, rate: r.rate, currencyCode: r.currency_code, exchangeRate: r.exchange_rate, date: r.date, reason: r.reason ?? null, locationId: r.location_id ?? null, yarnType: r.yarn_type ?? null, yarnWeight: r.yarn_weight ?? null, multiplyBy: r.multiply_by ?? null }}
        customers={rawCustomers ?? []}
        lots={lotList}
        locations={rawLocs ?? []}
      />
    </div>
  )
}
