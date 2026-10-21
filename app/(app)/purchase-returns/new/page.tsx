import { requireAuth } from '@/lib/auth/require-auth'
import { PeriodLockBanner } from "@/components/period-lock-banner"
import { createAdminClient } from '@/lib/supabase/admin'
import { loadItemProfiles, profileOf } from '@/lib/inventory/item-profiles'
import { loadStockPositions } from '@/lib/inventory/stock-position'
import { CreatePurchaseReturnForm } from './create-purchase-return-form'

export default async function NewPurchaseReturnPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawSuppliers }, { data: rawCustomers }, { data: rawLots }, { data: rawOrders }, { data: rawLocs }] = await Promise.all([
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name, count, unit_of_measure').eq('tenant_id', tenantId).order('name'),
    admin.from('purchase_orders')
      .select('id, date, supplier_id, stock_item_id, quantity, rate, currency_code, grade_id, lot_no, weight_per_carton, rate_basis')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .limit(200),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId).order('name'),
  ])

  // Formula profiles (from item types), grades and grade / lot stock drive the
  // carton and grade / lot fields on each return line.
  const [profiles, { data: rawGrades }, positions] = await Promise.all([
    loadItemProfiles(admin, tenantId),
    admin.from('grades').select('id, name').eq('tenant_id', tenantId).order('sort_order').order('name'),
    loadStockPositions(admin, tenantId),
  ])
  const supplierList = rawSuppliers ?? []
  const customerList = rawCustomers ?? []
  const lotList = (rawLots ?? []).map((l) => ({ ...l, count: String(l.count ?? ''), unitOfMeasure: l.unit_of_measure ?? null, profile: profileOf(profiles, l.id) }))
  const purchaseOrderList = (rawOrders ?? []).map((o) => ({
    id: o.id,
    date: o.date,
    supplierId: o.supplier_id,
    stockItemId: o.stock_item_id,
    quantity: o.quantity,
    rate: o.rate,
    currencyCode: o.currency_code,
    gradeId: o.grade_id,
    lotNo: o.lot_no,
    weightPerCarton: o.weight_per_carton,
    rateBasis: o.rate_basis,
  }))
  const locations = rawLocs ?? []

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <PeriodLockBanner className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Purchase Return</h1>
        <p className="text-sm text-muted-foreground mt-1">Return goods to a supplier. Stock will be decremented.</p>
      </div>
      <CreatePurchaseReturnForm
        today={today}
        suppliers={supplierList}
        customers={customerList}
        lots={lotList}
        purchaseOrders={purchaseOrderList}
        locations={locations}
        grades={rawGrades ?? []}
        positions={positions}
      />
    </div>
  )
}
