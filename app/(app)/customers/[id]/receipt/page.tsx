import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { PeriodLockBanner } from '@/components/period-lock-banner'
import { createAdminClient } from '@/lib/supabase/admin'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'
import { RecordReceiptForm } from '@/app/(app)/customers/record-receipt-form'

type Props = { params: Promise<{ id: string }> }

export default async function CustomerReceiptPage({ params }: Props) {
  const { tenantId } = await requireAuth()
  const { id } = await params
  const today = new Date().toISOString().split('T')[0]
  const admin = createAdminClient()

  const { data: customer } = await admin
    .from('tajir_customers')
    .select('id, name')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!customer) notFound()

  const [nextSerial, { data: rawBanks }, { data: rawSuppliers }] = await Promise.all([
    peekNextDocumentSerial(admin, tenantId, 'ar_receipt', today),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
    // For Direct Payment lines: suppliers the customer may have paid for us.
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name'),
  ])

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <PeriodLockBanner className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Record Receipt — {customer.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">Record a payment received from this customer.</p>
      </div>
      <RecordReceiptForm customerId={id} customerName={customer.name} today={today} nextSerial={nextSerial} banks={rawBanks ?? []} suppliers={rawSuppliers ?? []} />
    </div>
  )
}
