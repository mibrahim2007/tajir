import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreatePaymentForm } from './create-payment-form'

export default async function NewPaymentPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawSuppliers }, { data: rawPurchases }, { data: rawPayments }, { data: rawReturns }, { data: rawLots }, { data: rawBanks }] = await Promise.all([
    admin.from('suppliers')
      .select('id, name, opening_balance_pkr_equivalent')
      .eq('tenant_id', tenantId)
      .order('name'),
    admin.from('purchase_orders')
      .select('id, supplier_id, date, stock_item_id, quantity, pkr_equivalent, advance_paid')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false }),
    admin.from('ap_payments')
      .select('supplier_id, pkr_equivalent')
      .eq('tenant_id', tenantId),
    admin.from('purchase_returns')
      .select('supplier_id, pkr_equivalent')
      .eq('tenant_id', tenantId),
    admin.from('inventory_lots')
      .select('id, name')
      .eq('tenant_id', tenantId),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
  ])

  const suppliers = rawSuppliers ?? []
  const purchases = rawPurchases ?? []
  const payments = rawPayments ?? []
  const returns = rawReturns ?? []
  const lotMap = new Map((rawLots ?? []).map((l) => [l.id, l.name]))
  const banks = rawBanks ?? []

  // Compute outstanding per supplier
  const supplierList = suppliers.map((s) => {
    const opening = parseFloat(s.opening_balance_pkr_equivalent ?? '0')
    const purchased = purchases.filter((p) => p.supplier_id === s.id).reduce((sum, p) => sum + parseFloat(p.pkr_equivalent) - parseFloat(p.advance_paid), 0)
    const paid = payments.filter((p) => p.supplier_id === s.id).reduce((sum, p) => sum + parseFloat(p.pkr_equivalent), 0)
    const returned = returns.filter((r) => r.supplier_id === s.id).reduce((sum, r) => sum + parseFloat(r.pkr_equivalent), 0)
    return { id: s.id, name: s.name, outstanding: opening + purchased - paid - returned }
  })

  // Group purchases by supplier (most recent first, limit 10 per supplier)
  const purchasesBySupplier: Record<string, { id: string; date: string; itemName: string; qty: number; pkrEquivalent: number; advancePaid: number }[]> = {}
  for (const p of purchases) {
    if (!purchasesBySupplier[p.supplier_id]) purchasesBySupplier[p.supplier_id] = []
    if (purchasesBySupplier[p.supplier_id].length < 10) {
      purchasesBySupplier[p.supplier_id].push({
        id: p.id,
        date: p.date,
        itemName: lotMap.get(p.stock_item_id) ?? '—',
        qty: p.quantity,
        pkrEquivalent: parseFloat(p.pkr_equivalent),
        advancePaid: parseFloat(p.advance_paid),
      })
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Payment</h1>
        <p className="text-sm text-muted-foreground mt-1">Record a payment made to a supplier.</p>
      </div>
      <CreatePaymentForm today={today} suppliers={supplierList} purchasesBySupplier={purchasesBySupplier} banks={banks} />
    </div>
  )
}
