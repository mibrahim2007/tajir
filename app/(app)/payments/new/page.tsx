import { requireAuth } from '@/lib/auth/require-auth'
import { PendingChequesPanel } from "@/components/pending-cheques-panel"
import { PeriodLockBanner } from "@/components/period-lock-banner"
import { createAdminClient } from '@/lib/supabase/admin'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'
import { CreatePaymentForm } from './create-payment-form'

export default async function NewPaymentPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawSuppliers }, { data: rawPurchases }, { data: rawPayments }, { data: rawReturns }, { data: rawDebitNotes }, { data: rawRefunds }, { data: rawLots }, { data: rawBanks }] = await Promise.all([
    admin.from('suppliers')
      .select('id, name, opening_balance_pkr_equivalent')
      .eq('tenant_id', tenantId)
      .order('name'),
    admin.from('purchase_orders')
      .select('id, supplier_id, date, stock_item_id, quantity, pkr_equivalent, advance_paid')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false }),
    admin.from('ap_payments')
      .select('id, supplier_id, date, pkr_equivalent')
      .eq('tenant_id', tenantId),
    admin.from('purchase_returns')
      .select('id, supplier_id, date, pkr_equivalent')
      .eq('tenant_id', tenantId),
    admin.from('debit_notes')
      .select('id, supplier_id, pkr_equivalent')
      .eq('tenant_id', tenantId),
    admin.from('supplier_refunds')
      .select('id, supplier_id, pkr_equivalent')
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
  const debitNotes = rawDebitNotes ?? []
  const refunds = rawRefunds ?? []
  const lotMap = new Map((rawLots ?? []).map((l) => [l.id, l.name]))
  const banks = rawBanks ?? []
  const nextSerial = await peekNextDocumentSerial(admin, tenantId, 'ap_payment', today)

  // Compute outstanding per supplier — mirror the supplier-ledger balance
  // (lib/ledger/consolidated.ts): opening + purchases(net of advance) − payments
  // − returns − debit notes + supplier refunds. A refund received from the
  // supplier settles our debit balance with them, pulling the balance back up
  // toward zero; omitting it makes a fully-settled supplier read as negative.
  const supplierList = suppliers.map((s) => {
    const opening = s.opening_balance_pkr_equivalent  ?? 0
    const purchased = purchases.filter((p) => p.supplier_id === s.id).reduce((sum, p) => sum + p.pkr_equivalent - p.advance_paid, 0)
    const paid = payments.filter((p) => p.supplier_id === s.id).reduce((sum, p) => sum + p.pkr_equivalent, 0)
    const returned = returns.filter((r) => r.supplier_id === s.id).reduce((sum, r) => sum + r.pkr_equivalent, 0)
    const debited = debitNotes.filter((n) => n.supplier_id === s.id).reduce((sum, n) => sum + n.pkr_equivalent, 0)
    const refunded = refunds.filter((r) => r.supplier_id === s.id).reduce((sum, r) => sum + r.pkr_equivalent, 0)
    return { id: s.id, name: s.name, outstanding: opening + purchased - paid - returned - debited + refunded }
  })

  // Group purchases by supplier (most recent first, last 5 per supplier)
  const purchasesBySupplier: Record<string, { id: string; date: string; itemName: string; qty: number; pkrEquivalent: number; advancePaid: number }[]> = {}
  for (const p of purchases) {
    if (!purchasesBySupplier[p.supplier_id]) purchasesBySupplier[p.supplier_id] = []
    if (purchasesBySupplier[p.supplier_id].length < 5) {
      purchasesBySupplier[p.supplier_id].push({
        id: p.id,
        date: p.date,
        itemName: lotMap.get(p.stock_item_id) ?? '—',
        qty: p.quantity,
        pkrEquivalent: p.pkr_equivalent,
        advancePaid: p.advance_paid,
      })
    }
  }

  // Combined transaction history per supplier (bills, payments, returns),
  // most recent first, capped at 15 rows.
  const historyBySupplier: Record<string, { id: string; date: string; type: string; amount: number; direction: 'up' | 'down' }[]> = {}
  const pushHistory = (sid: string, item: { id: string; date: string; type: string; amount: number; direction: 'up' | 'down' }) => {
    (historyBySupplier[sid] ??= []).push(item)
  }
  for (const p of purchases)  pushHistory(p.supplier_id, { id: `pur-${p.id}`,  date: p.date, type: 'Purchase', amount: p.pkr_equivalent, direction: 'up' })
  for (const pm of payments)  pushHistory(pm.supplier_id, { id: `pay-${pm.id}`, date: pm.date, type: 'Payment',  amount: pm.pkr_equivalent, direction: 'down' })
  for (const rt of returns)   pushHistory(rt.supplier_id, { id: `ret-${rt.id}`, date: rt.date, type: 'Return',   amount: rt.pkr_equivalent, direction: 'down' })
  for (const sid of Object.keys(historyBySupplier)) {
    historyBySupplier[sid].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    historyBySupplier[sid] = historyBySupplier[sid].slice(0, 15)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PeriodLockBanner className="mb-4" />
      <PendingChequesPanel direction="out" className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Payment</h1>
        <p className="text-sm text-muted-foreground mt-1">Record a payment made to a supplier.</p>
      </div>
      <CreatePaymentForm today={today} suppliers={supplierList} purchasesBySupplier={purchasesBySupplier} banks={banks} nextSerial={nextSerial} historyBySupplier={historyBySupplier} />
    </div>
  )
}
