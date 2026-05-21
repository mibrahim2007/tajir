'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

export async function deleteCustomerAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id } = parsed.data

  const admin = createAdminClient()

  const { data: customer } = await admin
    .from('tajir_customers')
    .select('name, opening_balance, opening_balance_pkr_equivalent')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!customer) return { success: false, error: 'Customer not found', code: 'NOT_FOUND' }

  const { error } = await admin
    .from('tajir_customers')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to delete customer', code: 'INTERNAL_ERROR' }

  await createAuditEntry({ tenantId, userId: user.id, action: 'delete', entity: 'tajir_customers', entityId: id, before: { name: customer.name, openingBalance: customer.opening_balance, openingBalancePkrEquivalent: customer.opening_balance_pkr_equivalent } })

  return { success: true, data: undefined }
}
