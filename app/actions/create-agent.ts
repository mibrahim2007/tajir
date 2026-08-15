'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { commissionTypeSchema } from '@/lib/agents/commission'
import type { ActionResult } from '@/lib/types'

export const agentSchema = z.object({
  name:       z.string().trim().min(1, 'Name is required').max(200),
  agentCode:  z.string().trim().max(50).optional(),
  cnic:       z.string().trim().max(50).optional(),
  phone:      z.string().trim().max(50).optional(),
  email:      z.string().trim().max(200).optional(),
  city:       z.string().trim().max(100).optional(),
  address:    z.string().trim().max(500).optional(),

  saleCommissionType:     commissionTypeSchema.default('percentage'),
  saleCommissionRate:     z.coerce.number().min(0, 'Rate cannot be negative').default(0),
  purchaseCommissionType: commissionTypeSchema.default('percentage'),
  purchaseCommissionRate: z.coerce.number().min(0, 'Rate cannot be negative').default(0),

  // Commission already owed when the agent was enrolled. Held on the master
  // record and used as the ledger's opening line, exactly as customer and
  // supplier opening balances are.
  openingBalance: z.coerce.number().min(0, 'Opening balance cannot be negative').default(0),
  openingBalanceCurrency: z.enum(['PKR', 'USD']).default('PKR'),
  openingBalanceExchangeRate: z.coerce.number().positive().default(1),

  notes: z.string().trim().max(1000).optional(),
})
  // A percentage above 100 is always a typo — it would pay the agent more than
  // the invoice is worth. Per-unit and flat rates have no such ceiling.
  .refine(
    (d) => d.saleCommissionType !== 'percentage' || d.saleCommissionRate <= 100,
    { message: 'Sale commission cannot exceed 100%', path: ['saleCommissionRate'] },
  )
  .refine(
    (d) => d.purchaseCommissionType !== 'percentage' || d.purchaseCommissionRate <= 100,
    { message: 'Purchase commission cannot exceed 100%', path: ['purchaseCommissionRate'] },
  )

export type CreateAgentInput = z.infer<typeof agentSchema>

// Enrols a commission agent (broker / arhti). An agent is a distinct party —
// neither customer, supplier, employee nor owner — and is the sub-ledger
// dimension for the commission we owe on the trade they introduce.
export async function createAgentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = agentSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only the Owner can enrol agents', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const d = parsed.data
  const admin = createAdminClient()

  const pkrEquivalent = d.openingBalanceCurrency === 'USD'
    ? d.openingBalance * d.openingBalanceExchangeRate
    : d.openingBalance

  const { data: agent, error } = await admin
    .from('agents')
    .insert({
      tenant_id:  tenantId,
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
    .select('id')
    .single()

  if (error || !agent) {
    // The only uniqueness the table enforces is the optional code, so a
    // constraint failure here can be named precisely rather than generically.
    if (error?.code === '23505') {
      return { success: false, error: 'Another agent already uses that code', code: 'VALIDATION_ERROR' }
    }
    return { success: false, error: 'Failed to enrol agent', code: 'INTERNAL_ERROR' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create', entity: 'agents', entityId: agent.id,
    after: {
      name: d.name, agentCode: d.agentCode, phone: d.phone,
      saleCommissionType: d.saleCommissionType, saleCommissionRate: d.saleCommissionRate,
      purchaseCommissionType: d.purchaseCommissionType, purchaseCommissionRate: d.purchaseCommissionRate,
      openingBalance: d.openingBalance,
    },
  })

  return { success: true, data: agent }
}
