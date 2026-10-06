import { notFound } from 'next/navigation'
import { PeriodLockBanner } from '@/components/period-lock-banner'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'
import { OwnerTransactionForm } from '../../owner-transaction-form'

export default async function OwnerTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  // Owner equity — per-owner ledger — is owner-only.
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: owner } = await admin
    .from('owners')
    .select('id, name')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!owner) notFound()

  const [{ data: rawBanks }, nextSerial] = await Promise.all([
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
    peekNextDocumentSerial(admin, tenantId, 'owner_withdrawal', today),
  ])

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <PeriodLockBanner className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Owner Capital Movement</h1>
        <p className="text-sm text-muted-foreground mt-1">Record cash {owner.name} takes out of, or puts into, the business.</p>
      </div>
      <OwnerTransactionForm ownerId={owner.id} today={today} nextSerial={nextSerial} banks={rawBanks ?? []} returnPath={`/owners/${owner.id}/ledger`} />
    </div>
  )
}
