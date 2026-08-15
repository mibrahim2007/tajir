'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { agentSchema } from './create-agent'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid('Invalid agent') }).and(agentSchema)
const activeSchema = z.object({ id: z.string().uuid(), isActive: z.boolean() })

/**
 * Updates an agent's contact details and commission terms.
 *
 * Changing a rate is FORWARD-LOOKING only: every accrual already posted keeps
 * the rate stored on its own `agent_commissions` row, so past invoices are never
 * restated behind the agent's back. Re-saving an affected invoice is what
 * applies a new rate to it.
 */
export async function editAgentAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only the Owner can edit agents', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, ...d } = parsed.data
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('agents')
    .select('name, agent_code, sale_commission_type, sale_commission_rate, purchase_commission_type, purchase_commission_rate, opening_balance')
    .eq('id', id).eq('tenant_id', tenantId).maybeSingle()

  if (!existing) return { success: false, error: 'Agent not found', code: 'NOT_FOUND' }

  const pkrEquivalent = d.openingBalanceCurrency === 'USD'
    ? d.openingBalance * d.openingBalanceExchangeRate
    : d.openingBalance

  const { error } = await admin
    .from('agents')
    .update({
      name:       d.name,
      agent_code: d.agentCode || null,
      cnic:       d.cnic || null,
      phone:      d.phone || null,
      email:      d.email || null,
      city:       d.city || null,
      address:    d.address || null,
      sale_commission_type:     d.saleCommissionType,
      sale_commission_rate:     d.saleCommissionRate,
      purchase_commission_type: d.purchaseCommissionType,
      purchase_commission_rate: d.purchaseCommissionRate,
      opening_balance:                d.openingBalance,
      opening_balance_currency:       d.openingBalanceCurrency,
      opening_balance_pkr_equivalent: pkrEquivalent,
      notes: d.notes || null,
    })
    .eq('id', id).eq('tenant_id', tenantId)

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Another agent already uses that code', code: 'VALIDATION_ERROR' }
    }
    return { success: false, error: 'Failed to update agent', code: 'INTERNAL_ERROR' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'update', entity: 'agents', entityId: id,
    before: existing,
    after: {
      name: d.name, agentCode: d.agentCode,
      saleCommissionType: d.saleCommissionType, saleCommissionRate: d.saleCommissionRate,
      purchaseCommissionType: d.purchaseCommissionType, purchaseCommissionRate: d.purchaseCommissionRate,
      openingBalance: d.openingBalance,
    },
  })

  return { success: true, data: undefined }
}

/**
 * Retires (or reinstates) an agent.
 *
 * Retiring only hides them from the pickers on new invoices — their ledger,
 * accruals and outstanding payable all stay exactly as they are, and their old
 * invoices remain editable.
 */
export async function setAgentActiveAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = activeSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only the Owner can retire agents', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, isActive } = parsed.data
  const admin = createAdminClient()

  const { error } = await admin
    .from('agents').update({ is_active: isActive }).eq('id', id).eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update agent', code: 'INTERNAL_ERROR' }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'update', entity: 'agents', entityId: id,
    after: { isActive },
  })

  return { success: true, data: undefined }
}
