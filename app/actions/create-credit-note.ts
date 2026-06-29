'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  customerId:   z.string().uuid('Invalid customer'),
  saleOrderId:  z.string().uuid().optional(),
  amount:       z.coerce.number().positive('Amount must be positive'),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.coerce.number().positive().default(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  reason:       z.string().optional(),
  reference:    z.string().optional(),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD transactions', path: ['exchangeRate'] },
)

export type CreateCreditNoteInput = z.infer<typeof schema>

export async function createCreditNoteAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, tenantId } = await requireAuth()

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { customerId, saleOrderId, amount, currencyCode, exchangeRate, date, reason, reference } = parsed.data
  const pkrEquivalent = amount * (currencyCode === 'USD' ? exchangeRate : 1)

  const admin = createAdminClient()

  const { count: coaCount } = await admin
    .from('chart_of_accounts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (!coaCount) {
    return { success: false, error: 'Chart of accounts is not set up. Go to Accounts and configure it first.', code: 'COA_NOT_CONFIGURED' }
  }

  const { data: note, error: insertError } = await admin
    .from('credit_notes')
    .insert({
      tenant_id:      tenantId,
      customer_id:    customerId,
      sale_order_id:  saleOrderId ?? null,
      amount:         String(amount),
      currency_code:  currencyCode,
      exchange_rate:  String(exchangeRate),
      pkr_equivalent: String(pkrEquivalent),
      date,
      reason:         reason ?? null,
      reference:      reference ?? null,
    })
    .select('id')
    .single()

  if (insertError || !note) {
    return { success: false, error: 'Failed to create credit note', code: 'INTERNAL_ERROR' }
  }

  // GL: DR Sales Returns & Allowances, CR Accounts Receivable
  await postJournalEntry({
    tenantId,
    date,
    description: `Credit Note${reason ? ` — ${reason}` : ''}${reference ? ` (Ref: ${reference})` : ''}`,
    sourceType:  'credit_note',
    sourceId:    note.id,
    prefix:      'CN',
    lines: [
      { accountSystemKey: 'sales_returns_contra', debit: pkrEquivalent, credit: 0, customerId },
      { accountSystemKey: 'accounts_receivable',  debit: 0, credit: pkrEquivalent, customerId },
    ],
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create',
    entity: 'credit_notes', entityId: note.id,
    after: { customerId, amount, currencyCode, pkrEquivalent, date, reason, reference },
  })

  return { success: true, data: note }
}
