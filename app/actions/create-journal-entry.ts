'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const lineSchema = z.object({
  accountId:   z.string().uuid('Invalid account'),
  description: z.string().optional(),
  debit:       z.coerce.number().min(0),
  credit:      z.coerce.number().min(0),
  customerId:  z.string().uuid().optional(),
  supplierId:  z.string().uuid().optional(),
  stockItemId: z.string().uuid().optional(),
}).refine(
  (l) => !(l.debit > 0 && l.credit > 0),
  { message: 'A line cannot have both debit and credit', path: ['debit'] },
).refine(
  (l) => l.debit > 0 || l.credit > 0,
  { message: 'Each line must have a debit or credit amount', path: ['debit'] },
)

const schema = z.object({
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  description: z.string().min(1, 'Description is required'),
  reference:   z.string().optional(),
  bankId:      z.string().uuid().optional(),
  lines:       z.array(lineSchema).min(2, 'At least 2 lines required'),
}).refine((d) => {
  const totalDebit  = d.lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = d.lines.reduce((s, l) => s + l.credit, 0)
  return Math.abs(totalDebit - totalCredit) < 0.01
}, { message: 'Total debits must equal total credits', path: ['lines'] })

export type CreateJournalEntryInput = z.infer<typeof schema>

export async function createJournalEntryAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can post journal entries', code: 'UNAUTHORIZED' }
  }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { date, description, reference, bankId, lines } = parsed.data
  const admin = createAdminClient()

  // Get next voucher number
  const { data: voucherNumber } = await admin.rpc('get_next_voucher_number', {
    p_tenant_id: tenantId,
    p_prefix: 'JV',
  })

  if (!voucherNumber) {
    return { success: false, error: 'Failed to generate voucher number', code: 'INTERNAL_ERROR' }
  }

  const { data: entry, error: entryError } = await admin
    .from('tajir_journal_entries')
    .insert({
      tenant_id:      tenantId,
      voucher_number: voucherNumber as string,
      date,
      description,
      reference:      reference ?? null,
      bank_id:        bankId ?? null,
      source_type:    'manual',
      source_id:      null,
    })
    .select('id')
    .single()

  if (entryError || !entry) {
    return { success: false, error: 'Failed to create journal entry', code: 'INTERNAL_ERROR' }
  }

  const lineRows = lines.map((l) => ({
    journal_entry_id: entry.id,
    tenant_id:        tenantId,
    account_id:       l.accountId,
    description:      l.description ?? null,
    debit:            String(l.debit),
    credit:           String(l.credit),
    customer_id:      l.customerId ?? null,
    supplier_id:      l.supplierId ?? null,
    stock_item_id:    l.stockItemId ?? null,
  }))

  const { error: linesError } = await admin.from('tajir_journal_entry_lines').insert(lineRows)

  if (linesError) {
    await admin.from('tajir_journal_entries').delete().eq('id', entry.id)
    return { success: false, error: 'Failed to save journal lines', code: 'INTERNAL_ERROR' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create',
    entity: 'journal_entries', entityId: entry.id,
    after: { voucherNumber, date, description, reference, lineCount: lines.length },
  })

  return { success: true, data: entry }
}
