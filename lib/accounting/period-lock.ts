import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

// Period locking: "the books are locked through <date>".
//
// The real enforcement is a database trigger on tajir_journal_entries and its
// lines (migration 0039) — that is what actually guarantees nothing slips into a
// closed period, including writes from the mobile edge functions and any future
// module that posts GL without going through these helpers.
//
// Everything here is for the USER EXPERIENCE: check first so we can say "the
// books are locked through 30 Jun 2026" instead of surfacing a Postgres
// exception, and recognise the trigger's error if one races past the check.

export const PERIOD_LOCKED = 'PERIOD_LOCKED'

/** The lock-through date for a tenant, or null when nothing is locked. */
export async function getLockedThrough(
  admin: SupabaseClient,
  tenantId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('accounting_locks')
    .select('locked_through')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return (data?.locked_through as string | undefined) ?? null
}

/** True when `date` (YYYY-MM-DD) falls inside the locked period. */
export function isLocked(date: string, lockedThrough: string | null): boolean {
  return !!lockedThrough && date <= lockedThrough
}

/** Recognises the trigger's exception coming back through PostgREST. */
export function isPeriodLockedError(message?: string | null): boolean {
  return !!message && message.includes(PERIOD_LOCKED)
}

export function formatLockDate(lockedThrough: string): string {
  const [y, m, d] = lockedThrough.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d} ${months[Number(m) - 1]} ${y}`
}

export function periodLockedResult(lockedThrough: string, what = 'This'): ActionResult<never> {
  return {
    success: false,
    error: `${what} falls in a closed period — the books are locked through ${formatLockDate(lockedThrough)}. Move the lock date back if you need to change it.`,
    code: PERIOD_LOCKED,
  }
}

/**
 * Guard for an action that is about to write into `date`. Returns a failure
 * result to hand straight back to the caller, or null when the period is open.
 */
export async function checkPeriodOpen(
  tenantId: string,
  date: string,
  what = 'This',
): Promise<ActionResult<never> | null> {
  const lockedThrough = await getLockedThrough(createAdminClient(), tenantId)
  return isLocked(date, lockedThrough) ? periodLockedResult(lockedThrough!, what) : null
}
