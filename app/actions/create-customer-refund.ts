'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { nextDocumentSerial } from '@/lib/serials/next-serial'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  customerId:    z.string().uuid('Invalid customer'),
  amount:        z.coerce.number().positive('Amount must be positive'),
  currencyCode:  z.enum(['PKR', 'USD']),
  exchangeRate:  z.coerce.number().positive().default(1),
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentMethod: z.enum(['cash', 'bank_transfer']),
  notes:         z.string().optional(),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD transactions', path: ['exchangeRate'] },
)

export type CreateCustomerRefundInput = z.infer<typeof schema>

export async function createCustomerRefundAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, role, tenantId } = await requireAuth()

  if (role !== 'owner') {
    return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }
  }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { customerId, amount, currencyCode, exchangeRate, date, paymentMethod, notes } = parsed.data
  const pkrEquivalent = amount * (currencyCode === 'USD' ? exchangeRate : 1)

  const admin = createAdminClient()

  const { count: coaCount } = await admin
    .from('chart_of_accounts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (!coaCount) {
    return { success: false, error: 'Chart of accounts is not set up. Go to Accounts and configure it first.', code: 'COA_NOT_CONFIGURED' }
  }

  const serialNumber = await nextDocumentSerial(admin, tenantId, 'customer_refund', date)
  const { data: refund, error: insertError } = await admin
    .from('customer_refunds')
    .insert({
      tenant_id:      tenantId,
      serial_number:  serialNumber,
      customer_id:    customerId,
      amount:         amount,
      currency_code:  currencyCode,
      exchange_rate:  exchangeRate,
      pkr_equivalent: pkrEquivalent,
      date,
      payment_method: paymentMethod,
      notes:          notes ?? null,
    })
    .select('id')
    .single()

  if (insertError || !refund) {
    return { success: false, error: 'Failed to create customer refund', code: 'INTERNAL_ERROR' }
  }

  // GL: DR Accounts Receivable (reduces the customer's credit balance), CR Cash in Hand / Bank
  const cashAccountKey = paymentMethod === 'bank_transfer' ? 'cash_at_bank' : 'cash_in_hand'
  await postJournalEntry({
    tenantId,
    date,
    description: `Customer Refund${notes ? ` — ${notes}` : ''} (${paymentMethod === 'bank_transfer' ? 'Bank Transfer' : 'Cash'})`,
    reference:   serialNumber,
    sourceType:  'customer_refund',
    sourceId:    refund.id,
    prefix:      'RF',
    lines: [
      { accountSystemKey: 'accounts_receivable', debit: pkrEquivalent, credit: 0, customerId },
      { accountSystemKey: cashAccountKey,        debit: 0, credit: pkrEquivalent },
    ],
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create',
    entity: 'customer_refunds', entityId: refund.id,
    after: { customerId, amount, currencyCode, pkrEquivalent, date, paymentMethod, notes },
  })

  return { success: true, data: refund }
}
