import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadYarnLotIds } from '@/lib/inventory/yarn-lots'
import { loadPolyesterLotIds } from '@/lib/inventory/polyester-lots'
import { CreatePurchaseForm } from '../../../new/create-purchase-form'

export default async function EditPurchaseInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: invoiceId } = await params
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    { data: invoiceLines },
    { data: rawSuppliers }, { data: rawCustomers }, { data: rawLots }, { data: rawLocs },
  ] = await Promise.all([
    admin.from('purchase_orders')
      .select('stock_item_id, quantity, rate, currency_code, exchange_rate, date, location_id, supplier_id, advance_paid, yarn_type, yarn_weight, multiply_by, nos_carton, weight_per_carton')
      .eq('invoice_id', invoiceId).eq('tenant_id', tenantId).order('created_at'),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name, count, unit_of_measure').eq('tenant_id', tenantId).order('name'),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId).order('name'),
  ])

  if (!invoiceLines || invoiceLines.length === 0) notFound()

  const [yarnLotIds, polyesterLotIds] = await Promise.all([
    loadYarnLotIds(admin, tenantId),
    loadPolyesterLotIds(admin, tenantId),
  ])
  const supplierList = rawSuppliers ?? []
  const customerList = rawCustomers ?? []
  const lotList = (rawLots ?? []).map((l) => ({ ...l, count: String(l.count ?? ''), unitOfMeasure: l.unit_of_measure ?? null, isYarn: yarnLotIds.has(l.id), isPolyester: polyesterLotIds.has(l.id) }))
  const locationList = rawLocs ?? []

  const first = invoiceLines[0]
  // Stored rate is already net of any discount, so discountPct starts at 0.
  const initialValues = {
    supplierId:   first.supplier_id,
    date:         first.date,
    notes:        '',
    advancePaid:  invoiceLines.reduce((s, l) => s + (l.advance_paid ?? 0), 0),
    currencyCode: (first.currency_code === 'USD' ? 'USD' : 'PKR') as 'PKR' | 'USD',
    exchangeRate: first.exchange_rate,
    locationId:   first.location_id ?? '',
    lines: invoiceLines.map((l) => ({
      stockItemId:     l.stock_item_id,
      quantity:        l.quantity,
      rate:            l.rate,
      discountPct:     0,
      yarnType:        l.yarn_type ?? '',
      yarnWeight:      l.yarn_weight ?? NaN,
      multiplyBy:      l.multiply_by ?? 1,
      nosCarton:       l.nos_carton ?? NaN,
      weightPerCarton: l.weight_per_carton ?? NaN,
    })),
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit Purchase Invoice</h1>
        <p className="text-sm text-muted-foreground mt-1">Update items, quantities, rates, or details for this invoice.</p>
      </div>
      <CreatePurchaseForm
        today={today}
        suppliers={supplierList}
        customers={customerList}
        lots={lotList}
        locations={locationList}
        mode="edit"
        invoiceId={invoiceId}
        initialValues={initialValues}
      />
    </div>
  )
}
