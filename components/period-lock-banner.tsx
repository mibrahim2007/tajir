import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLockedThrough, formatLockDate } from '@/lib/accounting/period-lock'

/**
 * Warns, before anything is filled in, that a period is closed.
 *
 * Saving into a locked period is already refused by the database, but only once
 * the form is submitted — which on a long invoice means losing the work. This
 * says so up front.
 *
 * Renders nothing when no lock is set, which is the normal case, so it can be
 * dropped into every document form without cluttering the usual view.
 */
export async function PeriodLockBanner({ className }: { className?: string }) {
  const { tenantId } = await requireAuth()
  const lockedThrough = await getLockedThrough(createAdminClient(), tenantId)
  if (!lockedThrough) return null

  return (
    <div
      role="status"
      className={`rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 ${className ?? ''}`}
    >
      <span className="font-semibold">Books closed through {formatLockDate(lockedThrough)}.</span>{' '}
      Anything dated on or before that cannot be saved, changed, or deleted. Use a later date, or
      ask an owner to move the lock date back.
    </div>
  )
}
