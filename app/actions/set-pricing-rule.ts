'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  customerId:  z.string().uuid('Invalid customer'),
  stockItemId: z.string().uuid('Invalid stock item'),
  rate:        z.coerce.number().positive('Rate must be positive'),
})

export async function setPricingRuleAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { customerId, stockItemId, rate } = parsed.data

  const admin = createAdminClient()

  // Supersede any existing active rule
  const { data: existing } = await admin
    .from('customer_price_lists')
    .select('id, rate')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .eq('stock_item_id', stockItemId)
    .eq('is_active', true)
    .single()

  if (existing) {
    await admin
      .from('customer_price_lists')
      .update({ is_active: false, superseded_at: new Date().toISOString() })
      .eq('id', existing.id)
  }

  const { data: newRule, error } = await admin
    .from('customer_price_lists')
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      stock_item_id: stockItemId,
      rate: rate,
      is_active: true,
    })
    .select('id')
    .single()

  if (error || !newRule) {
    return { success: false, error: 'Failed to set pricing rule', code: 'INTERNAL_ERROR' }
  }

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: existing ? 'update' : 'create',
    entity: 'customer_price_lists',
    entityId: newRule.id,
    before: existing ? { rate: existing.rate } : undefined,
    after: { customerId, stockItemId, rate },
  })

  return { success: true, data: undefined }
}
