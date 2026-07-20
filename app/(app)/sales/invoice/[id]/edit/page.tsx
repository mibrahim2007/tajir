import { notFound } from 'next/navigation'
import { PeriodLockBanner } from "@/components/period-lock-banner"
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadYarnLotIds } from '@/lib/inventory/yarn-lots'
import { loadPolyesterLotIds } from '@/lib/inventory/polyester-lots'
import { EditSaleInvoiceForm } from './edit-sale-invoice-form'
import type { SaleFormValues } from '../../../sale-invoice-form'

export default async function EditSaleInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: invoiceId } = await params
  const { tenantId, role } = await requireAuth()
  const admin = createAdminClient()

  const [
    { data: invoiceLines },
    { data: rawCustomers }, { data: rawSuppliers }, { data: rawItems }, { data: rawRules },
    { data: rawLocs }, { data: rawLocStock }, { data: rawPurchases },
    { data: rawSales }, { data: rawReceipts }, { data: rawReturns }, { data: rawCreditNotes }, { data: rawRefunds },
  ] = await Promise.all([
    admin.from('sales_orders')
      .select('stock_item_id, quantity, rate, currency_code, exchange_rate, date, payment_due_date, due_days, customer_id, location_id, po_no, dc_no, notes, yarn_type, yarn_weight, multiply_by, nos_carton, weight_per_carton')
      .eq('invoice_id', invoiceId).eq('tenant_id', tenantId).order('created_at'),
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

  if (!invoiceLines || invoiceLines.length === 0) notFound()

  // Latest PKR cost per unit for each stock item (first row per item = most recent purchase)
  const costMap: Record<string, number> = {}
  for (const p of rawPurchases ?? []) {
    if (!costMap[p.stock_item_id]) {
      costMap[p.stock_item_id] = p.pkr_equivalent / p.quantity
    }
  }

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

  const [yarnLotIds, polyesterLotIds] = await Promise.all([
    loadYarnLotIds(admin, tenantId),
    loadPolyesterLotIds(admin, tenantId),
  ])
  const customers = (rawCustomers ?? []).map((c) => ({ id: c.id, name: c.name }))
  const suppliers = (rawSuppliers ?? []).map((s) => ({ id: s.id, name: s.name }))
  const stockItems = (rawItems ?? []).map((l) => ({
    id: l.id, name: l.name, currentQuantity: l.current_quantity, barcode: l.code ?? null, unitOfMeasure: l.unit_of_measure ?? null,
    itemNature: (l.item_nature === 'service' ? 'service' : 'inventory') as 'inventory' | 'service',
    isYarn: yarnLotIds.has(l.id),
    isPolyester: polyesterLotIds.has(l.id),
  }))
  const pricingRules = (rawRules ?? []).map((r) => ({ customerId: r.customer_id, stockItemId: r.stock_item_id, rate: r.rate }))
  const locations = rawLocs ?? []
  const locationStock = (rawLocStock ?? []).map((ls) => ({
    stockItemId: ls.stock_item_id ?? '', locationId: ls.location_id ?? '', quantity: ls.quantity ?? 0,
  }))

  const first = invoiceLines[0]
  // Stored rate is already net of any discount, so discountPct starts at 0.
  const initialValues: SaleFormValues = {
    customerId:     first.customer_id,
    date:           first.date,
    paymentDueDate: first.payment_due_date ?? '',
    dueDays:        first.due_days ?? undefined,
    poNo:           invoiceLines.find((l) => l.po_no && l.po_no.trim())?.po_no ?? '',
    dcNo:           invoiceLines.find((l) => l.dc_no && l.dc_no.trim())?.dc_no ?? '',
    notes:          invoiceLines.find((l) => l.notes && l.notes.trim())?.notes ?? '',
    currencyCode:   (first.currency_code === 'USD' ? 'USD' : 'PKR'),
    exchangeRate:   first.exchange_rate,
    // Service lines store a null location; use the first stockable line's location.
    locationId:     invoiceLines.find((l) => l.location_id)?.location_id ?? '',
    lines: invoiceLines.map((l) => ({
      stockItemId: l.stock_item_id,
      quantity:    l.quantity,
      rate:        l.rate,
      discountPct: 0,
      yarnType:    l.yarn_type ?? '',
      yarnWeight:  l.yarn_weight ?? NaN,
      multiplyBy:  l.multiply_by ?? 1,
      nosCarton:       l.nos_carton ?? NaN,
      weightPerCarton: l.weight_per_carton ?? NaN,
    })),
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PeriodLockBanner className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit Sale Invoice</h1>
        <p className="text-sm text-muted-foreground mt-1">Update items, quantities, rates, or details for this invoice.</p>
      </div>
      <EditSaleInvoiceForm
        invoiceId={invoiceId}
        initialValues={initialValues}
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
