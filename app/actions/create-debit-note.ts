'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  supplierId:      z.string().uuid('Invalid supplier'),
  purchaseOrderId: z.string().uuid().optional(),
  amount:          z.coerce.number().positive('Amount must be positive'),
  currencyCode:    z.enum(['PKR', 'USD']),
  exchangeRate:    z.coerce.number().positive().default(1),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  reason:          z.string().optional(),
  reference:       z.string().optional(),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD transactions', path: ['exchangeRate'] },
)

export type CreateDebitNoteInput = z.infer<typeof schema>

export async function createDebitNoteAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, tenantId } = await requireAuth()

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { supplierId, purchaseOrderId, amount, currencyCode, exchangeRate, date, reason, reference } = parsed.data
  const pkrEquivalent = amount * (currencyCode === 'USD' ? exchangeRate : 1)

  const admin = createAdminClient()

  const { count: coaCount } = await admin
    .from('chart_of_accounts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (!coaCount) {
    return { success: false, error: 'Chart of accounts is not set up. Go to Accounts and configure it first.', code: 'COA_NOT_CONFIGURED' }
  }

  const { data: note, error: insertError } = await admin
    .from('debit_notes')
    .insert({
      tenant_id:          tenantId,
      supplier_id:        supplierId,
      purchase_order_id:  purchaseOrderId ?? null,
      amount:             amount,
      currency_code:      currencyCode,
      exchange_rate:      exchangeRate,
      pkr_equivalent:     pkrEquivalent,
      date,
      reason:             reason ?? null,
      reference:          reference ?? null,
    })
    .select('id')
    .single()

  if (insertError || !note) {
    return { success: false, error: 'Failed to create debit note', code: 'INTERNAL_ERROR' }
  }

  // GL: DR Accounts Payable, CR Purchase Returns Contra
  await postJournalEntry({
    tenantId,
    date,
    description: 'Debit Note',
    reference:   reference || undefined,
    sourceType:  'debit_note',
    sourceId:    note.id,
    prefix:      'DN',
    lines: [
      { accountSystemKey: 'accounts_payable',          debit: pkrEquivalent, credit: 0, supplierId },
      { accountSystemKey: 'purchase_returns_contra',   debit: 0, credit: pkrEquivalent, supplierId },
    ],
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create',
    entity: 'debit_notes', entityId: note.id,
    after: { supplierId, amount, currencyCode, pkrEquivalent, date, reason, reference },
  })

  return { success: true, data: note }
}
