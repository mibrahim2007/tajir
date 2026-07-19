'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  name:           z.string().trim().min(1, 'Name is required').max(200),
  cnic:           z.string().trim().max(50).optional(),
  phone:          z.string().trim().max(50).optional(),
  email:          z.string().trim().max(200).optional(),
  profitSharePct: z.coerce.number().min(0, 'Share cannot be negative').max(100, 'Share cannot exceed 100%').default(0),
  notes:          z.string().trim().optional(),
})

// Creates an owner/partner master record (owner-only). An owner is a distinct
// party — neither a customer, supplier, nor employee — and is the sub-ledger
// dimension for capital contributions and drawings.
export async function createOwnerAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can manage owners', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { name, cnic, phone, email, profitSharePct, notes } = parsed.data
  const admin = createAdminClient()

  const { data: owner, error } = await admin
    .from('owners')
    .insert({
      tenant_id:        tenantId,
      name,
      cnic:             cnic || null,
      phone:            phone || null,
      email:            email || null,
      profit_share_pct: profitSharePct,
      notes:            notes || null,
    })
    .select('id')
    .single()

  if (error || !owner) {
    return { success: false, error: 'Failed to create owner', code: 'INTERNAL_ERROR' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create', entity: 'owners', entityId: owner.id,
    after: { name, cnic, phone, profitSharePct },
  })

  return { success: true, data: owner }
}
