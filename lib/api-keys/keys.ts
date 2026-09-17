import { createHash, randomBytes } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { apiKeys, type ApiKey, type ApiScope } from '@/db/schema'

const KEY_PREFIX = 'tjr_live_'
const DISPLAY_PREFIX_LEN = 12

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

/**
 * Mint a new key for a tenant. Returns the plaintext exactly once — the
 * caller must show it to the owner and never persist it.
 */
export async function createApiKey(params: {
  tenantId: string
  createdBy: string
  name: string
  scopes: ApiScope[]
  expiresAt?: Date | null
}): Promise<{ key: ApiKey; plaintext: string }> {
  const plaintext = KEY_PREFIX + randomBytes(32).toString('base64url')
  const [key] = await db
    .insert(apiKeys)
    .values({
      tenantId: params.tenantId,
      createdBy: params.createdBy,
      name: params.name.trim(),
      scopes: params.scopes,
      keyPrefix: plaintext.slice(0, DISPLAY_PREFIX_LEN),
      keyHash: hashApiKey(plaintext),
      expiresAt: params.expiresAt ?? null,
    })
    .returning()
  return { key, plaintext }
}

/** Soft-revoke. Tenant-scoped so an owner can only revoke their own keys. */
export async function revokeApiKey(tenantId: string, keyId: string): Promise<boolean> {
  const rows = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.tenantId, tenantId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id })
  return rows.length > 0
}

export async function listApiKeys(tenantId: string) {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      createdAt: apiKeys.createdAt,
      expiresAt: apiKeys.expiresAt,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.tenantId, tenantId))
    .orderBy(apiKeys.createdAt)
}
