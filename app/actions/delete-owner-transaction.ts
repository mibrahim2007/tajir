'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

// Deletes an owner capital movement (owner-only) and reverses its GL by
// removing the journal entry (lines cascade). Tender lines cascade from the
// transaction row. Mirrors the GL cleanup in deleteSaleInvoiceAction — the
// journal entry MUST go, or the ledger keeps an orphaned equity posting.
export async function deleteOwnerTransactionAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id } = parsed.data
  const admin = createAdminClient()

  const { data: txn } = await admin
    .from('owner_transactions')
    .select('owner_id, txn_type, amount, currency_code, pkr_equivalent, date, serial_number')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!txn) return { success: false, error: 'Transaction not found', code: 'NOT_FOUND' }

  // Reverse the GL first so a failed delete can never leave a dangling entry.
  await admin.from('tajir_journal_entries').delete()
    .eq('tenant_id', tenantId)
    .eq('source_type', txn.txn_type === 'withdrawal' ? 'owner_withdrawal' : 'owner_contribution')
    .eq('source_id', id)

  const { error } = await admin.from('owner_transactions').delete().eq('id', id).eq('tenant_id', tenantId)
  if (error) return { success: false, error: 'Failed to delete transaction', code: 'INTERNAL_ERROR' }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'delete', entity: 'owner_transactions', entityId: id,
    before: {
      ownerId: txn.owner_id, txnType: txn.txn_type, amount: txn.amount,
      currencyCode: txn.currency_code, pkrEquivalent: txn.pkr_equivalent,
      date: txn.date, serialNumber: txn.serial_number,
    },
  })

  return { success: true, data: undefined }
}
