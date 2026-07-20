import { requireAuth } from '@/lib/auth/require-auth'
import { PeriodLockBanner } from "@/components/period-lock-banner"
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateDebitNoteForm } from './create-debit-note-form'

export default async function NewDebitNotePage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawSuppliers }, { data: rawOrders }] = await Promise.all([
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('purchase_orders')
      .select('id, date, supplier_id, pkr_equivalent, currency_code')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .limit(200),
  ])

  const supplierList = rawSuppliers ?? []
  const purchaseOrderList = (rawOrders ?? []).map((o) => ({
    id: o.id,
    date: o.date,
    supplierId: o.supplier_id,
    pkrEquivalent: o.pkr_equivalent,
    currencyCode: o.currency_code,
  }))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PeriodLockBanner className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Debit Note</h1>
        <p className="text-sm text-muted-foreground mt-1">Issue a debit note against a supplier — reduces what you owe them.</p>
      </div>
      <CreateDebitNoteForm
        today={today}
        suppliers={supplierList}
        purchaseOrders={purchaseOrderList}
      />
    </div>
  )
}
