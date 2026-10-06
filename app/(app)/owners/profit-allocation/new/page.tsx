import { PeriodLockBanner } from '@/components/period-lock-banner'
import { requireAuth } from '@/lib/auth/require-auth'
import { AllocateProfitForm } from '../allocate-profit-form'

export default async function NewProfitAllocationPage() {
  const { role } = await requireAuth()
  // Owner equity — profit allocation — is owner-only.
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const today = new Date().toISOString().split('T')[0]
  const firstOfYear = today.slice(0, 4) + '-01-01'

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <PeriodLockBanner className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Allocate Profit to Owners</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Net profit is computed from the ledger for the period, then split by each owner&rsquo;s share %.
        </p>
      </div>
      <AllocateProfitForm defaultFrom={firstOfYear} defaultTo={today} />
    </div>
  )
}
