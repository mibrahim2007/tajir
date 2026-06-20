'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  expenseAccountId: z.string().uuid('Select an expense account'),
  amount:           z.coerce.number().positive('Amount must be positive'),
  date:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  description:      z.string().min(1, 'Description is required'),
  note:             z.string().optional(),
  bankId:           z.string().uuid().optional(),
})

export async function createExpenseAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { expenseAccountId, amount, date, description, note, bankId } = parsed.data
  const admin = createAdminClient()

  // Verify expense account belongs to this tenant
  const { data: expenseAcc } = await admin
    .from('chart_of_accounts')
    .select('id, code, name, account_type')
    .eq('id', expenseAccountId)
    .eq('tenant_id', tenantId)
    .single()

  if (!expenseAcc) return { success: false, error: 'Expense account not found', code: 'NOT_FOUND' }

  // Look up cash_in_hand account
  const { data: cashAcc } = await admin
    .from('chart_of_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('system_key', 'cash_in_hand')
    .single()

  if (!cashAcc) return { success: false, error: 'Chart of accounts not seeded. Go to Accounts and seed first.', code: 'COA_NOT_SEEDED' }

  // Get next voucher number
  const { data: voucherNumber } = await admin.rpc('get_next_voucher_number', {
    p_tenant_id: tenantId,
    p_prefix: 'EX',
  })

  if (!voucherNumber) return { success: false, error: 'Failed to generate voucher number', code: 'INTERNAL_ERROR' }

  const narration = note ? `${description} — ${note}` : description

  // Insert journal entry
  const { data: entry, error: entryErr } = await admin
    .from('tajir_journal_entries')
    .insert({
      tenant_id:      tenantId,
      voucher_number: voucherNumber as string,
      date,
      description:    narration,
      bank_id:        bankId ?? null,
      source_type:    'expense',
      source_id:      crypto.randomUUID(),
    })
    .select('id')
    .single()

  if (entryErr || !entry) return { success: false, error: 'Failed to record expense', code: 'INTERNAL_ERROR' }

  // Insert lines: DR expense account, CR cash
  await admin.from('tajir_journal_entry_lines').insert([
    { journal_entry_id: entry.id, tenant_id: tenantId, account_id: expenseAccountId, description: narration, debit: String(amount), credit: '0' },
    { journal_entry_id: entry.id, tenant_id: tenantId, account_id: cashAcc.id,       description: narration, debit: '0',            credit: String(amount) },
  ])

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create', entity: 'tajir_journal_entries', entityId: entry.id,
    after: { expenseAccountId, amount, date, description: narration, voucherNumber },
  })

  return { success: true, data: { id: entry.id } }
}
