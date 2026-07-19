'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { checkPeriodOpen } from "@/lib/accounting/period-lock"
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

export async function deleteJournalEntryAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid ID', code: 'VALIDATION_ERROR' }
  }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can delete journal entries', code: 'UNAUTHORIZED' }
  }

  const admin = createAdminClient()

  const { data: entry } = await admin
    .from('tajir_journal_entries')
    .select('id, voucher_number, source_type, date, description')
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)
    .single()

  if (!entry) {
    return { success: false, error: 'Journal entry not found', code: 'NOT_FOUND' }
  }

  const locked = await checkPeriodOpen(tenantId, entry.date as string, "This voucher")
  if (locked) return locked

  // Prevent deleting auto-posted entries directly; they're managed by source document deletion
  if (entry.source_type !== 'manual') {
    return {
      success: false,
      error: 'Auto-posted entries cannot be deleted directly. Delete the source document instead.',
      code: 'VALIDATION_ERROR',
    }
  }

  const { error } = await admin
    .from('tajir_journal_entries')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { success: false, error: 'Failed to delete journal entry', code: 'INTERNAL_ERROR' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'delete',
    entity: 'journal_entries', entityId: parsed.data.id,
    before: entry,
  })

  return { success: true, data: undefined }
}
