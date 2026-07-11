import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { BanksClient } from './banks-client'

export default async function BanksPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const { data: banks } = await admin
    .from('banks')
    .select('id, name, account_number, branch, opening_balance')
    .eq('tenant_id', tenantId)
    .order('created_at')

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Banks</h1>
        <p className="text-sm text-muted-foreground mt-1">Define bank accounts used for payments, receipts, and vouchers.</p>
      </div>
      <BanksClient banks={banks ?? []} />
    </div>
  )
}
