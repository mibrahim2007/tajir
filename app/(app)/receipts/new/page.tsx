import { requireAuth } from '@/lib/auth/require-auth'
import { PeriodLockBanner } from "@/components/period-lock-banner"
import { createAdminClient } from '@/lib/supabase/admin'
import { listOnlineReceiptAccounts } from '@/lib/receipts/online-accounts'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'
import { loadInvoiceReceivables, openDocs } from '@/lib/receivables/invoice-receivables'
import { CreateReceiptForm } from './create-receipt-form'
import type { OpenInvoice } from '@/components/invoice-allocations'

export default async function NewReceiptPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawCustomers }, { data: rawSales }, { data: rawReceipts }, { data: rawReturns }, { data: rawCreditNotes }, { data: rawRefunds }, { data: rawBanks }, { data: rawSuppliers }, onlineAccounts, receivables] = await Promise.all([
    admin.from('tajir_customers')
      .select('id, name, opening_balance_pkr_equivalent')
      .eq('tenant_id', tenantId)
      .order('name'),
    admin.from('sales_orders')
      .select('id, customer_id, date, pkr_equivalent')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false }),
    admin.from('ar_receipts')
      .select('id, customer_id, date, pkr_equivalent')
      .eq('tenant_id', tenantId),
    admin.from('sale_returns')
      .select('id, customer_id, date, pkr_equivalent')
      .eq('tenant_id', tenantId),
    admin.from('credit_notes')
      .select('id, customer_id, pkr_equivalent')
      .eq('tenant_id', tenantId),
    admin.from('customer_refunds')
      .select('id, customer_id, pkr_equivalent')
      .eq('tenant_id', tenantId),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name'),
    listOnlineReceiptAccounts(admin, tenantId),
    loadInvoiceReceivables(admin, tenantId),
  ])

  const customers = rawCustomers ?? []
  const sales = rawSales ?? []
  const receipts = rawReceipts ?? []
  const returns = rawReturns ?? []
  const creditNotes = rawCreditNotes ?? []
  const refunds = rawRefunds ?? []
  const banks = rawBanks ?? []
  const nextSerial = await peekNextDocumentSerial(admin, tenantId, 'ar_receipt', today)

  // Compute outstanding per customer — mirror the customer-ledger balance
  // (lib/ledger/consolidated.ts): opening + sales − receipts − returns
  // − credit notes + refunds. A refund settles the customer's credit balance,
  // so it pulls the balance back up toward zero; omitting it makes a
  // fully-settled customer read as a negative (credit) outstanding.
  const customerList = customers.map((c) => {
    const opening = c.opening_balance_pkr_equivalent  ?? 0
    const billed = sales.filter((s) => s.customer_id === c.id).reduce((sum, s) => sum + s.pkr_equivalent, 0)
    const received = receipts.filter((r) => r.customer_id === c.id).reduce((sum, r) => sum + r.pkr_equivalent, 0)
    const returned = returns.filter((r) => r.customer_id === c.id).reduce((sum, r) => sum + r.pkr_equivalent, 0)
    const credited = creditNotes.filter((n) => n.customer_id === c.id).reduce((sum, n) => sum + n.pkr_equivalent, 0)
    const refunded = refunds.filter((r) => r.customer_id === c.id).reduce((sum, r) => sum + r.pkr_equivalent, 0)
    return { id: c.id, name: c.name, outstanding: opening + billed - received - returned - credited + refunded }
  })

  // Open invoices per customer, oldest first, for "receive against invoice".
  // The opening balance has no invoice to name, so it is left out here.
  const openInvoicesByCustomer: Record<string, OpenInvoice[]> = {}
  for (const c of receivables) {
    const open = openDocs(c).filter((d) => !d.isOpening)
    if (open.length === 0) continue
    openInvoicesByCustomer[c.partyId] = open.map((d) => ({
      key: d.key, serial: d.serial, ref: d.ref, date: d.date, dueDate: d.dueDate, amount: d.amount, balance: d.balance,
    }))
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
    <div className="p-6 max-w-[1440px] mx-auto">
      <PeriodLockBanner className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Receipt</h1>
        <p className="text-sm text-muted-foreground mt-1">Record a payment received from a customer.</p>
      </div>
      <CreateReceiptForm today={today} customers={customerList} openInvoicesByCustomer={openInvoicesByCustomer} banks={banks} suppliers={rawSuppliers ?? []} onlineAccounts={onlineAccounts} nextSerial={nextSerial} historyByCustomer={historyByCustomer} />
    </div>
  )
}
