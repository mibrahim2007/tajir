import { notFound, redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { EditSaleForm } from '../../edit-sale-form'

// Quick edit of a single (non-invoice) sale order. Invoice lines are edited
// as a whole at /sales/invoice/[id]/edit.
export default async function EditSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()

  const [{ data: order }, { data: rawCustomers }, { data: rawLots }, { data: rawPurchases }, { data: rawLocs }] = await Promise.all([
    admin.from('sales_orders')
      .select('id, invoice_id, date, customer_id, stock_item_id, quantity, rate, currency_code, exchange_rate, payment_due_date, location_id')
      .eq('id', id).eq('tenant_id', tenantId).maybeSingle(),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name, unit_of_measure').eq('tenant_id', tenantId).order('name'),
    admin.from('purchase_orders').select('stock_item_id, pkr_equivalent, quantity')
      .eq('tenant_id', tenantId).order('date', { ascending: false }).order('created_at', { ascending: false }),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId).order('name'),
  ])

  if (!order) notFound()
  if (order.invoice_id) redirect(`/sales/invoice/${order.invoice_id}/edit`)

  const lots = (rawLots ?? []).map((l) => ({ id: l.id, name: l.name, unitOfMeasure: l.unit_of_measure ?? null }))

  // Latest purchase cost per item, for the below-cost warning.
  const costMap: Record<string, number> = {}
  for (const p of rawPurchases ?? []) {
    if (!costMap[p.stock_item_id])
      costMap[p.stock_item_id] = p.pkr_equivalent / p.quantity
  }

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit Sale</h1>
        <p className="text-sm text-muted-foreground mt-1">Update the quantity, rate, dates or location of this sale order.</p>
      </div>
      <EditSaleForm
        sale={{ id: order.id, customerId: order.customer_id, stockItemId: order.stock_item_id, quantity: order.quantity, rate: order.rate, currencyCode: order.currency_code, exchangeRate: order.exchange_rate, date: order.date, paymentDueDate: order.payment_due_date, locationId: order.location_id }}
        customers={rawCustomers ?? []}
        lots={lots}
        locations={rawLocs ?? []}
        costMap={costMap}
      />
    </div>
  )
}
