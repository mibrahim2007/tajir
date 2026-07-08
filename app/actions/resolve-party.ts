'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

/**
 * Resolve a picked party id to a record of the type a form requires.
 *
 * The party pickers list customers AND suppliers together, so a user can pick a
 * supplier on a sale (or a customer on a purchase). But sales store customer_id
 * and purchases store supplier_id, each with a hard FK to its own table. This
 * mirrors the picked party into the required table: if it already IS that type,
 * return it as-is; otherwise reuse a same-name record or create one, and return
 * that id. The transaction then saves against a valid same-type party.
 */
export async function resolvePartyAction(input: {
  partyId: string
  requiredType: 'customer' | 'supplier'
}): Promise<ActionResult<{ id: string }>> {
  const { user, tenantId } = await requireAuth()
  const admin = createAdminClient()

  const targetTable = input.requiredType === 'customer' ? 'tajir_customers' : 'suppliers'
  const otherTable  = input.requiredType === 'customer' ? 'suppliers' : 'tajir_customers'

  // Already the required type — nothing to mirror.
  const { data: existing } = await admin
    .from(targetTable).select('id')
    .eq('id', input.partyId).eq('tenant_id', tenantId).maybeSingle()
  if (existing) return { success: true, data: { id: existing.id } }

  // It's the other type — look up its name.
  const { data: other } = await admin
    .from(otherTable).select('name')
    .eq('id', input.partyId).eq('tenant_id', tenantId).maybeSingle()
  if (!other) return { success: false, error: 'Selected party not found', code: 'NOT_FOUND' }

  // Reuse an existing same-name record in the target table if one exists.
  const { data: matches } = await admin
    .from(targetTable).select('id')
    .eq('tenant_id', tenantId).ilike('name', other.name).limit(1)
  if (matches && matches.length > 0) return { success: true, data: { id: matches[0].id } }

  // Otherwise create the mirror with a zero opening balance.
  const { data: created, error } = await admin
    .from(targetTable)
    .insert({
      tenant_id: tenantId,
      name: other.name,
      opening_balance: 0,
      opening_balance_currency: 'PKR',
      opening_balance_pkr_equivalent: 0,
    })
    .select('id')
    .single()
  if (error || !created) return { success: false, error: 'Failed to link party', code: 'INTERNAL_ERROR' }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create', entity: targetTable, entityId: created.id,
    after: { name: other.name, mirroredFrom: otherTable },
  })

  return { success: true, data: { id: created.id } }
}
