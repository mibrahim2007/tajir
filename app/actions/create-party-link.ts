'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  customerId: z.string().uuid('Select a customer'),
  supplierId: z.string().uuid('Select a supplier'),
})

// Maps a customer account to its supplier counterpart so their ledgers can be
// consolidated. Owner-only. One-to-one within a tenant (enforced by unique
// constraints on party_links).
export async function createPartyLinkAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const { customerId, supplierId } = parsed.data
  const admin = createAdminClient()

  // Confirm both parties belong to this tenant.
  const [{ data: customer }, { data: supplier }] = await Promise.all([
    admin.from('tajir_customers').select('id').eq('id', customerId).eq('tenant_id', tenantId).maybeSingle(),
    admin.from('suppliers').select('id').eq('id', supplierId).eq('tenant_id', tenantId).maybeSingle(),
  ])
  if (!customer) return { success: false, error: 'Customer not found', code: 'NOT_FOUND' }
  if (!supplier) return { success: false, error: 'Supplier not found', code: 'NOT_FOUND' }

  const { data, error } = await admin
    .from('party_links')
    .insert({ tenant_id: tenantId, customer_id: customerId, supplier_id: supplierId })
    .select('id')
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      return {
        success: false,
        error: 'That customer or supplier is already mapped. Remove the existing mapping first.',
        code: 'DUPLICATE',
      }
    }
    return { success: false, error: 'Failed to map accounts', code: 'INTERNAL_ERROR' }
  }

  return { success: true, data }
}
