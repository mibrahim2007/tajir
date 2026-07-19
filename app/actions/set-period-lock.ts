'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { getLockedThrough } from '@/lib/accounting/period-lock'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  // null clears the lock and reopens everything.
  lockedThrough: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').nullable(),
  note:          z.string().trim().max(300).optional(),
})

// Sets (or clears) the tenant's "books locked through" date — owner only.
//
// Locking is enforced by a database trigger, not here; this just records the
// date. Moving the lock BACKWARDS (or clearing it) reopens closed periods, so
// it is deliberately owner-gated and written to the audit log either way.
export async function setPeriodLockAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can close the books', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { lockedThrough, note } = parsed.data
  const admin = createAdminClient()
  const previous = await getLockedThrough(admin, tenantId)

  if (lockedThrough === null) {
    const { error } = await admin.from('accounting_locks').delete().eq('tenant_id', tenantId)
    if (error) return { success: false, error: 'Failed to clear the lock', code: 'INTERNAL_ERROR' }
  } else {
    const { error } = await admin
      .from('accounting_locks')
      .upsert({
        tenant_id:      tenantId,
        locked_through: lockedThrough,
        note:           note || null,
        updated_at:     new Date().toISOString(),
        updated_by:     user.id,
      }, { onConflict: 'tenant_id' })
    if (error) return { success: false, error: 'Failed to set the lock', code: 'INTERNAL_ERROR' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'update', entity: 'accounting_locks', entityId: tenantId,
    before: { lockedThrough: previous },
    after:  { lockedThrough, note: note || null },
  })

  return { success: true, data: undefined }
}
