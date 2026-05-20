'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { db } from '@/db'
import { suppliers } from '@/db/schema'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'
import type { Supplier } from '@/db/schema'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  openingBalance: z.coerce.number().min(0).default(0),
  openingBalanceCurrency: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.coerce.number().positive().default(1),
})

export async function createSupplierAction(
  input: unknown,
): Promise<ActionResult<Supplier>> {
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

  const { name, openingBalance, openingBalanceCurrency, exchangeRate } = parsed.data

  const pkrEquivalent =
    openingBalanceCurrency === 'USD'
      ? openingBalance * exchangeRate
      : openingBalance

  const [supplier] = await db
    .insert(suppliers)
    .values({
      tenantId,
      name,
      openingBalance: String(openingBalance),
      openingBalanceCurrency,
      openingBalancePkrEquivalent: String(pkrEquivalent),
    })
    .returning()

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'create',
    entity: 'suppliers',
    entityId: supplier.id,
    after: { name, openingBalance, openingBalanceCurrency },
  })

  return { success: true, data: supplier }
}
