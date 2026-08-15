'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { optionalEmailField, toStoredEmail } from '@/lib/email/address'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  id:     z.string().uuid(),
  name:   z.string().min(1, 'Name is required'),
  email:  optionalEmailField,
  phone:  z.string().trim().optional(),
  status: z.enum(['active', 'inactive', 'low_transaction']).default('active'),
})

export async function editCustomerAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, name, email, phone, status } = parsed.data
  const storedEmail = toStoredEmail(email)

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('tajir_customers')
    .select('name, email, phone, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!existing) return { success: false, error: 'Customer not found', code: 'NOT_FOUND' }

  const { error } = await admin
    .from('tajir_customers')
    .update({ name, email: storedEmail, phone: phone || null, status })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to update customer', code: 'INTERNAL_ERROR' }

  await createAuditEntry({ tenantId, userId: user.id, action: 'update', entity: 'tajir_customers', entityId: id, before: { name: existing.name, email: existing.email, phone: existing.phone, status: existing.status }, after: { name, email: storedEmail, phone: phone || null, status } })

  return { success: true, data: undefined }
}
