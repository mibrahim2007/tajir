'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

export async function deleteExpenseAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id } = parsed.data
  const admin = createAdminClient()

  const { data: entry } = await admin
    .from('tajir_journal_entries')
    .select('source_type, description, date')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!entry) return { success: false, error: 'Expense not found', code: 'NOT_FOUND' }
  if (entry.source_type !== 'expense') return { success: false, error: 'Not an expense entry', code: 'VALIDATION_ERROR' }

  const { error } = await admin
    .from('tajir_journal_entries')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to delete expense', code: 'INTERNAL_ERROR' }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'delete', entity: 'tajir_journal_entries', entityId: id,
    before: { description: entry.description, date: entry.date },
  })

  return { success: true, data: undefined }
}
