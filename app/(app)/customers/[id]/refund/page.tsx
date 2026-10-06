import { notFound, redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { PeriodLockBanner } from '@/components/period-lock-banner'
import { createAdminClient } from '@/lib/supabase/admin'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'
import { formatPKR } from '@/lib/utils/currency'
import { RefundCustomerForm } from '@/app/(app)/customers/refund-customer-form'

type Props = { params: Promise<{ id: string }> }

export default async function CustomerRefundPage({ params }: Props) {
  const { tenantId, role } = await requireAuth()
  const { id } = await params
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const today = new Date().toISOString().split('T')[0]
  const admin = createAdminClient()

  const { data: customer } = await admin
    .from('tajir_customers')
    .select('id, name, opening_balance_pkr_equivalent')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!customer) notFound()

  const [{ data: rawSales }, { data: rawReceipts }, { data: rawReturns }, { data: rawCreditNotes }, { data: rawRefunds }, { data: rawBanks }, nextSerial] = await Promise.all([
    admin.from('sales_orders').select('pkr_equivalent').eq('customer_id', id).eq('tenant_id', tenantId),
    admin.from('ar_receipts').select('pkr_equivalent').eq('customer_id', id).eq('tenant_id', tenantId),
    admin.from('sale_returns').select('pkr_equivalent').eq('customer_id', id).eq('tenant_id', tenantId),
    admin.from('credit_notes').select('pkr_equivalent').eq('customer_id', id).eq('tenant_id', tenantId),
    admin.from('customer_refunds').select('pkr_equivalent').eq('customer_id', id).eq('tenant_id', tenantId),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
    peekNextDocumentSerial(admin, tenantId, 'customer_refund', today),
  ])

  // Same balance as the customer ledger: opening + sales − receipts − returns
  // − credit notes + refunds. A refund only applies while the customer is in credit.
  const sum = (rows: { pkr_equivalent: number }[] | null) => (rows ?? []).reduce((s, r) => s + r.pkr_equivalent, 0)
  const balance = customer.opening_balance_pkr_equivalent + sum(rawSales) - sum(rawReceipts) - sum(rawReturns) - sum(rawCreditNotes) + sum(rawRefunds)
  if (balance >= 0) redirect(`/customers/${id}/ledger`)
  const creditAmount = Math.abs(balance)

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <PeriodLockBanner className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Issue Refund — {customer.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">Pay back the {formatPKR(creditAmount)} credit to this customer.</p>
      </div>
      <RefundCustomerForm customerId={id} customerName={customer.name} today={today} creditAmount={creditAmount} nextSerial={nextSerial} banks={rawBanks ?? []} />
    </div>
  )
}
