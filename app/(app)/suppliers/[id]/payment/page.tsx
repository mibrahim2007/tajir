import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { PeriodLockBanner } from '@/components/period-lock-banner'
import { createAdminClient } from '@/lib/supabase/admin'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'
import { RecordPaymentForm } from '@/app/(app)/suppliers/record-payment-form'

type Props = { params: Promise<{ id: string }> }

export default async function SupplierPaymentPage({ params }: Props) {
  const { tenantId } = await requireAuth()
  const { id } = await params
  const today = new Date().toISOString().split('T')[0]
  const admin = createAdminClient()

  const { data: supplier } = await admin
    .from('suppliers')
    .select('id, name')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!supplier) notFound()

  const [nextSerial, { data: rawBanks }] = await Promise.all([
    peekNextDocumentSerial(admin, tenantId, 'ap_payment', today),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
  ])

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <PeriodLockBanner className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Record Payment — {supplier.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">Record a payment made to this supplier.</p>
      </div>
      <RecordPaymentForm supplierId={id} supplierName={supplier.name} today={today} nextSerial={nextSerial} banks={rawBanks ?? []} />
    </div>
  )
}
