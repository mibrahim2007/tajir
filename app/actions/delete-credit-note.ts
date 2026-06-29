'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

export async function deleteCreditNoteAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid ID', code: 'VALIDATION_ERROR' }
  }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can delete credit notes', code: 'UNAUTHORIZED' }
  }

  const admin = createAdminClient()

  const { data: note } = await admin
    .from('credit_notes')
    .select('customer_id, amount, currency_code, pkr_equivalent, date, reason, reference')
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)
    .single()

  if (!note) {
    return { success: false, error: 'Credit note not found', code: 'NOT_FOUND' }
  }

  // Reverse the GL entry
  const { data: glEntry } = await admin
    .from('tajir_journal_entries')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('source_type', 'credit_note')
    .eq('source_id', parsed.data.id)
    .single()

  if (glEntry) {
    await admin.from('tajir_journal_entries').delete().eq('id', glEntry.id)
  }

  const { error } = await admin
    .from('credit_notes')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { success: false, error: 'Failed to delete credit note', code: 'INTERNAL_ERROR' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'delete',
    entity: 'credit_notes', entityId: parsed.data.id,
    before: note,
  })

  return { success: true, data: undefined }
}
