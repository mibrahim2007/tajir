'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { createApiKey, revokeApiKey } from '@/lib/api-keys/keys'
import { apiScopeEnum } from '@/db/schema'
import type { ActionResult } from '@/lib/types'

const createSchema = z.object({
  name:      z.string().trim().min(1, 'Give the key a name').max(80),
  scopes:    z.array(z.enum(apiScopeEnum)).min(1, 'Pick at least one scope'),
  // null = never expires
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').nullable(),
})

// Mints a key for a third-party integration — owner only.
//
// The plaintext is returned to the caller exactly once and never stored; only
// its hash lives in api_keys. Creation and revocation are both audit-logged so
// the tenant can see who opened the door and when.
export async function createApiKeyAction(input: unknown): Promise<ActionResult<{ plaintext: string }>> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can manage API keys', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { name, scopes, expiresAt } = parsed.data
  if (expiresAt && expiresAt <= new Date().toISOString().split('T')[0]) {
    return { success: false, error: 'Expiry must be in the future', code: 'VALIDATION_ERROR' }
  }

  const { key, plaintext } = await createApiKey({
    tenantId,
    createdBy: user.id,
    name,
    scopes,
    // End of the chosen day in PKT (UTC+5), so "expires 30 Sep" works all of 30 Sep.
    expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59+05:00`) : null,
  })

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create', entity: 'api_keys', entityId: key.id,
    after: { name, scopes, keyPrefix: key.keyPrefix, expiresAt: key.expiresAt?.toISOString() ?? null },
  })

  return { success: true, data: { plaintext } }
}

const revokeSchema = z.object({ keyId: z.string().uuid() })

export async function revokeApiKeyAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = revokeSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid key', code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can manage API keys', code: 'UNAUTHORIZED' }

  const revoked = await revokeApiKey(tenantId, parsed.data.keyId)
  if (!revoked) return { success: false, error: 'Key not found or already revoked', code: 'NOT_FOUND' }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'update', entity: 'api_keys', entityId: parsed.data.keyId,
    after: { revokedAt: new Date().toISOString() },
  })

  return { success: true, data: undefined }
}
