import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'
import { CreateReceiptForm } from './create-receipt-form'

export default async function NewReceiptPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawCustomers }, { data: rawSales }, { data: rawReceipts }, { data: rawReturns }, { data: rawLots }, { data: rawBanks }] = await Promise.all([
    admin.from('tajir_customers')
      .select('id, name, opening_balance_pkr_equivalent')
      .eq('tenant_id', tenantId)
      .order('name'),
    admin.from('sales_orders')
      .select('id, customer_id, date, stock_item_id, quantity, pkr_equivalent')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false }),
    admin.from('ar_receipts')
      .select('id, customer_id, date, pkr_equivalent')
      .eq('tenant_id', tenantId),
    admin.from('sale_returns')
      .select('id, customer_id, date, pkr_equivalent')
      .eq('tenant_id', tenantId),
    admin.from('inventory_lots')
      .select('id, name')
      .eq('tenant_id', tenantId),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
  ])

  const customers = rawCustomers ?? []
  const sales = rawSales ?? []
  const receipts = rawReceipts ?? []
  const returns = rawReturns ?? []
  const lotMap = new Map((rawLots ?? []).map((l) => [l.id, l.name]))
  const banks = rawBanks ?? []
  const nextSerial = await peekNextDocumentSerial(admin, tenantId, 'ar_receipt', today)

  // Compute outstanding per customer
  const customerList = customers.map((c) => {
    const opening = c.opening_balance_pkr_equivalent  ?? 0
    const billed = sales.filter((s) => s.customer_id === c.id).reduce((sum, s) => sum + s.pkr_equivalent, 0)
    const received = receipts.filter((r) => r.customer_id === c.id).reduce((sum, r) => sum + r.pkr_equivalent, 0)
    const returned = returns.filter((r) => r.customer_id === c.id).reduce((sum, r) => sum + r.pkr_equivalent, 0)
    return { id: c.id, name: c.name, outstanding: opening + billed - received - returned }
  })

  // Group sales by customer (most recent first, last 5 per customer)
  const salesByCustomer: Record<string, { id: string; date: string; itemName: string; qty: number; pkrEquivalent: number }[]> = {}
  for (const s of sales) {
    if (!salesByCustomer[s.customer_id]) salesByCustomer[s.customer_id] = []
    if (salesByCustomer[s.customer_id].length < 5) {
      salesByCustomer[s.customer_id].push({
        id: s.id,
        date: s.date,
        itemName: lotMap.get(s.stock_item_id) ?? '—',
        qty: s.quantity,
        pkrEquivalent: s.pkr_equivalent,
      })
    }
  }

  // Combined transaction history per customer (invoices, receipts, returns),
  // most recent first, capped at 15 rows.
  const historyByCustomer: Record<string, { id: string; date: string; type: string; amount: number; direction: 'up' | 'down' }[]> = {}
  const pushHistory = (cid: string, item: { id: string; date: string; type: string; amount: number; direction: 'up' | 'down' }) => {
    (historyByCustomer[cid] ??= []).push(item)
  }
  for (const s of sales)     pushHistory(s.customer_id, { id: `sale-${s.id}`,   date: s.date, type: 'Sale',    amount: s.pkr_equivalent, direction: 'up' })
  for (const r of receipts)  pushHistory(r.customer_id, { id: `rcpt-${r.id}`,   date: r.date, type: 'Receipt', amount: r.pkr_equivalent, direction: 'down' })
  for (const rt of returns)  pushHistory(rt.customer_id, { id: `ret-${rt.id}`,  date: rt.date, type: 'Return',  amount: rt.pkr_equivalent, direction: 'down' })
  for (const cid of Object.keys(historyByCustomer)) {
    historyByCustomer[cid].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    historyByCustomer[cid] = historyByCustomer[cid].slice(0, 15)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Receipt</h1>
        <p className="text-sm text-muted-foreground mt-1">Record a payment received from a customer.</p>
      </div>
      <CreateReceiptForm today={today} customers={customerList} salesByCustomer={salesByCustomer} banks={banks} nextSerial={nextSerial} historyByCustomer={historyByCustomer} />
    </div>
  )
}
