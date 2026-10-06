import { PeriodLockBanner } from '@/components/period-lock-banner'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'
import { OwnerTransactionForm } from '../owner-transaction-form'

export default async function NewOwnerTransactionPage() {
  const { tenantId, role } = await requireAuth()
  // Owner equity — capital and drawings — is owner-only.
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawOwners }, { data: rawBanks }, nextSerial] = await Promise.all([
    admin.from('owners').select('id, name')
      .eq('tenant_id', tenantId).eq('is_active', true).order('created_at', { ascending: false }),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
    peekNextDocumentSerial(admin, tenantId, 'owner_withdrawal', today),
  ])

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <PeriodLockBanner className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Owner Capital Movement</h1>
        <p className="text-sm text-muted-foreground mt-1">Record cash an owner takes out of, or puts into, the business.</p>
      </div>
      <OwnerTransactionForm owners={rawOwners ?? []} today={today} nextSerial={nextSerial} banks={rawBanks ?? []} returnPath="/owners" />
    </div>
  )
}
