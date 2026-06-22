'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const lineSchema = z.object({
  stockItemId: z.string().uuid('Select a stock item'),
  quantity:    z.coerce.number().positive('Quantity must be positive'),
})

const schema = z.object({
  type:          z.enum(['purchase', 'sale']),
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid gatepass date'),
  vehicleNumber: z.string().optional(),
  driverName:    z.string().optional(),
  remarks:       z.string().optional(),
  lines:         z.array(lineSchema).min(1, 'Add at least one item'),
})

export type CreateGatepassInput = z.infer<typeof schema>

export async function createGatepassAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, tenantId } = await requireAuth()
  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { type, date, vehicleNumber, driverName, remarks, lines } = parsed.data
  const admin = createAdminClient()

  /* Auto-generate next GP number for this tenant */
  const { count: gpCount } = await admin
    .from('gatepasses')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
  const gateppassNumber = `GP-${String((gpCount ?? 0) + 1).padStart(4, '0')}`

  /* Insert master */
  const { data: gatepass, error: masterErr } = await admin
    .from('gatepasses')
    .insert({
      tenant_id:       tenantId,
      gatepass_number: gateppassNumber,
      type,
      date,
      vehicle_number:  vehicleNumber || null,
      driver_name:     driverName    || null,
      remarks:         remarks       ?? null,
    })
    .select('id')
    .single()

  if (masterErr || !gatepass) return { success: false, error: 'Failed to create gatepass', code: 'INTERNAL_ERROR' }

  /* Insert detail items */
  const itemRows = lines.map(l => ({
    gatepass_id:   gatepass.id,
    stock_item_id: l.stockItemId,
    quantity:      l.quantity,
  }))

  const { error: itemsErr } = await admin.from('gatepass_items').insert(itemRows)
  if (itemsErr) {
    await admin.from('gatepasses').delete().eq('id', gatepass.id)
    return { success: false, error: 'Failed to save gatepass items', code: 'INTERNAL_ERROR' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create', entity: 'gatepasses', entityId: gatepass.id,
    after: { gateppassNumber, type, date, vehicleNumber, driverName, itemCount: lines.length },
  })

  return { success: true, data: gatepass }
}
