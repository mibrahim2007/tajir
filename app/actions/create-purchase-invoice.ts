'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { nextDocumentSerial } from '@/lib/serials/next-serial'
import type { ActionResult } from '@/lib/types'

const lineSchema = z.object({
  stockItemId: z.string().uuid('Invalid stock item'),
  quantity:    z.number().positive('Quantity must be positive'),
  rate:        z.number().positive('Rate must be positive'),
  discountPct: z.number().min(0).max(100).default(0),
})

const schema = z.object({
  supplierId:   z.string().uuid('Invalid supplier'),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.coerce.number().positive().default(1),
  advancePaid:  z.coerce.number().min(0).default(0),
  locationId:   z.string().uuid('Location is required'),
  notes:        z.string().optional(),
  lines:        z.array(lineSchema).min(1, 'Add at least one item'),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD transactions', path: ['exchangeRate'] },
)

export type CreatePurchaseInvoiceInput = z.infer<typeof schema>

export async function createPurchaseInvoiceAction(
  input: unknown
): Promise<ActionResult<{ invoiceId: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  }

  const { user, tenantId } = await requireAuth()
  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { supplierId, date, currencyCode, exchangeRate, advancePaid, locationId, lines } = parsed.data
  const admin = createAdminClient()

  const { count: coaCount } = await admin
    .from('chart_of_accounts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (!coaCount) {
    return { success: false, error: 'Chart of accounts is not set up. Go to Accounts and configure it before recording purchases.', code: 'COA_NOT_CONFIGURED' }
  }

  const invoiceId = crypto.randomUUID()
  // One serial for the whole invoice — shared across every line row.
  const serialNumber = await nextDocumentSerial(admin, tenantId, 'purchase_order', date)
  const createdOrders: { id: string; stockItemId: string; pkrEquivalent: number; quantity: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const effectiveRate = line.rate * (1 - (line.discountPct || 0) / 100)
    const pkrEquivalent = line.quantity * effectiveRate * (currencyCode === 'USD' ? exchangeRate : 1)

    const { data: order, error } = await admin.from('purchase_orders').insert({
      tenant_id:      tenantId,
      serial_number:  serialNumber,
      supplier_id:    supplierId,
      stock_item_id:  line.stockItemId,
      quantity:       line.quantity,
      rate:           effectiveRate,
      currency_code:  currencyCode,
      exchange_rate:  exchangeRate,
      pkr_equivalent: pkrEquivalent,
      advance_paid:   i === 0 ? advancePaid : 0,
      date,
      location_id:    locationId,
      invoice_id:     invoiceId,
      confirmed_at:   new Date().toISOString(),
    }).select('id').single()

    if (error || !order) {
      // Rollback already-inserted lines
      if (createdOrders.length > 0) {
        await admin.from('purchase_orders').delete().in('id', createdOrders.map((o) => o.id))
        for (const o of createdOrders) {
          await admin.rpc('adjust_inventory_quantity', { p_lot_id: o.stockItemId, p_delta: -o.quantity })
        }
      }
      return { success: false, error: 'Failed to create purchase line', code: 'INTERNAL_ERROR' }
    }

    await admin.rpc('adjust_inventory_quantity', { p_lot_id: line.stockItemId, p_delta: line.quantity })
    createdOrders.push({ id: order.id, stockItemId: line.stockItemId, pkrEquivalent, quantity: line.quantity })
  }

  const totalPKR = createdOrders.reduce((s, o) => s + o.pkrEquivalent, 0)

  // Single GL entry for the whole invoice
  await postJournalEntry({
    tenantId, date, description: 'Purchase Invoice', reference: serialNumber,
    sourceType: 'purchase_invoice', sourceId: invoiceId, prefix: 'PI',
    lines: [
      ...createdOrders.map((o) => ({ accountSystemKey: 'inventory', debit: o.pkrEquivalent, credit: 0, stockItemId: o.stockItemId })),
      { accountSystemKey: 'accounts_payable', debit: 0, credit: totalPKR, supplierId },
    ],
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create',
    entity: 'purchase_orders', entityId: invoiceId,
    after: { supplierId, date, currencyCode, totalPKR, lineCount: lines.length },
  })

  return { success: true, data: { invoiceId } }
}
