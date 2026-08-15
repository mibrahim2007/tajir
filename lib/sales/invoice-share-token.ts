import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '@/lib/env'

/**
 * Public sale-document share links carry a signed token instead of a raw
 * database id. The signature (HMAC-SHA256, keyed by the service-role secret)
 * makes tokens unguessable and tamper-proof, so possessing one link never
 * lets a recipient enumerate or forge others.
 *
 * A sale document is either a grouped `invoice` (many lines, keyed by
 * invoice_id) or a solo `order` (a single sales_orders row). The kind is
 * encoded so the public route knows which loader to use.
 *
 * Token shape: `<code>_<id>.<sig>` where code is `i` (invoice) or `o` (order)
 * and sig is a truncated hex HMAC over `<code>_<id>`.
 */
export type SaleDocKind = 'invoice' | 'order'

const SIG_LEN = 24
const KIND_TO_CODE: Record<SaleDocKind, string> = { invoice: 'i', order: 'o' }
const CODE_TO_KIND: Record<string, SaleDocKind> = { i: 'invoice', o: 'order' }

function sign(payload: string): string {
  return createHmac('sha256', env.SUPABASE_SERVICE_ROLE_KEY).update(payload).digest('hex').slice(0, SIG_LEN)
}

export function signSaleShareToken(kind: SaleDocKind, id: string): string {
  const payload = `${KIND_TO_CODE[kind]}_${id}`
  return `${payload}.${sign(payload)}`
}

/** Returns { kind, id } when the token is valid and untampered, else null. */
export function verifySaleShareToken(token: string): { kind: SaleDocKind; id: string } | null {
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null

  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(payload)

  if (sig.length !== expected.length) return null
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null

  const sep = payload.indexOf('_')
  if (sep <= 0) return null

  const kind = CODE_TO_KIND[payload.slice(0, sep)]
  const id = payload.slice(sep + 1)
  if (!kind || !id) return null

  return { kind, id }
}
