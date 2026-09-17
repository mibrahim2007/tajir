import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { apiKeys, apiKeyRequests, type ApiKey, type ApiScope } from '@/db/schema'
import { hashApiKey } from './keys'

export type ApiKeyContext = {
  key: ApiKey
  tenantId: string
}

type Failure = { ok: false; response: Response }
type Success = { ok: true; ctx: ApiKeyContext }

function fail(status: number, error: string): Failure {
  return { ok: false, response: Response.json({ error }, { status }) }
}

/**
 * Authenticate a /api/v1 request via `Authorization: Bearer tjr_live_…`.
 * Resolves the tenant from the key — the caller never supplies a tenant id.
 */
export async function requireApiKey(req: Request, requiredScope: ApiScope): Promise<Success | Failure> {
  const header = req.headers.get('authorization') ?? ''
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return fail(401, 'Missing bearer token')

  const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hashApiKey(token))).limit(1)
  if (!key) return fail(401, 'Invalid API key')
  if (key.revokedAt) return fail(401, 'API key revoked')
  if (key.expiresAt && key.expiresAt < new Date()) return fail(401, 'API key expired')
  if (!key.scopes.includes(requiredScope)) return fail(403, `Missing scope: ${requiredScope}`)

  // Fire-and-forget; a failed touch must not fail the request.
  db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id)).catch(() => {})

  return { ok: true, ctx: { key, tenantId: key.tenantId } }
}

/** Append-only access log the tenant owner can review. */
export async function logApiRequest(
  req: Request,
  ctx: ApiKeyContext,
  status: number,
  rowCount?: number,
): Promise<void> {
  const url = new URL(req.url)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  await db
    .insert(apiKeyRequests)
    .values({
      apiKeyId: ctx.key.id,
      tenantId: ctx.tenantId,
      method: req.method,
      path: url.pathname,
      status,
      rowCount: rowCount ?? null,
      ip,
    })
    .catch(() => {})
}
