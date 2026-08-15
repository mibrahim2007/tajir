'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

/**
 * Deletes an agent who has never traded.
 *
 * Once an agent carries commission, payouts, or is named on an invoice, deleting
 * them would orphan the GL lines that still carry their `agent_id` and make the
 * commission on those documents unattributable. Those agents are retired
 * instead — see `setAgentActiveAction` — which is what this refusal points at.
 */
export async function deleteAgentAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only the Owner can delete agents', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id } = parsed.data
  const admin = createAdminClient()

  const { data: agent } = await admin
    .from('agents').select('name').eq('id', id).eq('tenant_id', tenantId).maybeSingle()
  if (!agent) return { success: false, error: 'Agent not found', code: 'NOT_FOUND' }

  const [commissions, payments, sales, purchases] = await Promise.all([
    admin.from('agent_commissions').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('agent_id', id),
    admin.from('agent_payments').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('agent_id', id),
    admin.from('sales_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('agent_id', id),
    admin.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('agent_id', id),
  ])

  const inUse =
    (commissions.count ?? 0) + (payments.count ?? 0) + (sales.count ?? 0) + (purchases.count ?? 0)

  if (inUse > 0) {
    return {
      success: false,
      error: `${agent.name} has trade recorded against them and can no longer be deleted. Retire the agent instead — their ledger stays intact and they stop appearing on new invoices.`,
      code: 'IN_USE',
    }
  }

  const { error } = await admin.from('agents').delete().eq('id', id).eq('tenant_id', tenantId)
  if (error) return { success: false, error: 'Failed to delete agent', code: 'INTERNAL_ERROR' }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'delete', entity: 'agents', entityId: id,
    before: { name: agent.name },
  })

  return { success: true, data: undefined }
}
