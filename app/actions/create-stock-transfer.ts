'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  fromLocationId: z.string().uuid('Invalid from-location'),
  toLocationId:   z.string().uuid('Invalid to-location'),
  stockItemId:    z.string().uuid('Invalid stock item'),
  quantity:       z.coerce.number().positive('Quantity must be positive'),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  notes:          z.string().max(500).optional(),
}).refine(
  (d) => d.fromLocationId !== d.toLocationId,
  { message: 'From and To locations must differ', path: ['toLocationId'] },
)

export async function createStockTransferAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, tenantId } = await requireAuth()
  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { fromLocationId, toLocationId, stockItemId, quantity, date, notes } = parsed.data
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('stock_transfers')
    .insert({
      tenant_id:        tenantId,
      from_location_id: fromLocationId,
      to_location_id:   toLocationId,
      stock_item_id:    stockItemId,
      quantity:         String(quantity),
      date,
      notes:            notes ?? null,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: 'Failed to create transfer', code: 'INTERNAL_ERROR' }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create',
    entity: 'stock_transfers', entityId: data.id,
    after: { fromLocationId, toLocationId, stockItemId, quantity, date },
  })
  return { success: true, data }
}
