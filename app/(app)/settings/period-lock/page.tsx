import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLockedThrough } from '@/lib/accounting/period-lock'
import { formatPKTDate } from '@/lib/utils/dates'
import { PeriodLockForm } from './period-lock-form'

export default async function PeriodLockPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const lockedThrough = await getLockedThrough(admin, tenantId)
  const today = new Date().toISOString().split('T')[0]

  // How much is already closed, so the owner can see what the lock is protecting.
  const { count: lockedEntries } = lockedThrough
    ? await admin.from('tajir_journal_entries')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .lte('date', lockedThrough)
    : { count: 0 }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-extrabold tracking-tight">Close the Books</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Lock a period so nothing can be posted into it, changed, or removed.
      </p>

      <div className={`mt-6 rounded-2xl border px-4 py-4 ${
        lockedThrough
          ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30'
          : 'bg-card'
      }`}>
        {lockedThrough ? (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Currently locked</p>
            <p className="text-xl font-extrabold mt-1">
              Everything up to {formatPKTDate(lockedThrough + 'T00:00:00')}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {lockedEntries ?? 0} journal {lockedEntries === 1 ? 'entry is' : 'entries are'} closed.
            </p>
          </>
        ) : (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Currently locked</p>
            <p className="text-xl font-extrabold mt-1">Nothing — all periods are open</p>
          </>
        )}
      </div>

      <div className="mt-4">
        <PeriodLockForm lockedThrough={lockedThrough} today={today} />
      </div>

      <div className="mt-6 rounded-lg border bg-muted/30 px-4 py-3 text-sm space-y-2">
        <p className="font-medium">What locking does</p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Sales, purchases, receipts, payments, returns, notes and vouchers dated on or before the lock date cannot be created, edited or deleted.</li>
          <li>Profit for a locked period cannot be allocated or reopened.</li>
          <li>It applies everywhere, including the mobile app — the rule lives in the database, not in one screen.</li>
          <li>Later dates are unaffected: day-to-day work carries on as normal.</li>
        </ul>
        <p className="text-muted-foreground">
          Moving the date back or clearing it reopens those periods. Both are recorded in the audit log.
        </p>
      </div>
    </div>
  )
}
