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
  supplierId:    z.string().uuid('Invalid supplier'),
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

export async function createSupplierRefundAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, tenantId } = await requireAuth()

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { supplierId, amount, currencyCode, exchangeRate, date, paymentMethod, notes } = parsed.data
  const pkrEquivalent = amount * (currencyCode === 'USD' ? exchangeRate : 1)

  const admin = createAdminClient()

  const serialNumber = await nextDocumentSerial(admin, tenantId, 'supplier_refund', date)
  const { data: refund, error: insertError } = await admin
    .from('supplier_refunds')
    .insert({
      tenant_id:      tenantId,
      serial_number:  serialNumber,
      supplier_id:    supplierId,
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
    return { success: false, error: 'Failed to record supplier refund', code: 'INTERNAL_ERROR' }
  }

  // GL: DR Cash in Hand / Bank (money received), CR Accounts Payable (reduces negative AP)
  const cashAccountKey = paymentMethod === 'bank_transfer' ? 'cash_at_bank' : 'cash_in_hand'
  await postJournalEntry({
    tenantId,
    date,
    description: `Supplier Refund${notes ? ` — ${notes}` : ''} (${paymentMethod === 'bank_transfer' ? 'Bank Transfer' : 'Cash'})`,
    reference:   serialNumber,
    sourceType:  'supplier_refund',
    sourceId:    refund.id,
    prefix:      'SR',
    lines: [
      { accountSystemKey: cashAccountKey,      debit: pkrEquivalent, credit: 0 },
      { accountSystemKey: 'accounts_payable',  debit: 0, credit: pkrEquivalent, supplierId },
    ],
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create',
    entity: 'supplier_refunds', entityId: refund.id,
    after: { supplierId, amount, currencyCode, pkrEquivalent, date, paymentMethod, notes },
  })

  return { success: true, data: refund }
}
