'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

export async function deletePricingRuleAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id } = parsed.data

  const admin = createAdminClient()

  const { data: rule } = await admin
    .from('customer_price_lists')
    .select('customer_id, stock_item_id, rate, is_active')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!rule) return { success: false, error: 'Pricing rule not found', code: 'NOT_FOUND' }

  const { error } = await admin
    .from('customer_price_lists')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to delete pricing rule', code: 'INTERNAL_ERROR' }

  await createAuditEntry({ tenantId, userId: user.id, action: 'delete', entity: 'customer_price_lists', entityId: id, before: { customerId: rule.customer_id, stockItemId: rule.stock_item_id, rate: rule.rate, isActive: rule.is_active } })

  return { success: true, data: undefined }
}
