// Query-string helpers shared by every /api/v1 endpoint.

export const round2 = (n: number) => Math.round(n * 100) / 100

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** `from`/`to` as YYYY-MM-DD, or null. Returns an error string if malformed. */
export function parseDateRange(url: URL): { from: string | null; to: string | null; error?: string } {
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (from && !DATE_RE.test(from)) return { from: null, to: null, error: 'from must be YYYY-MM-DD' }
  if (to && !DATE_RE.test(to)) return { from: null, to: null, error: 'to must be YYYY-MM-DD' }
  if (from && to && from > to) return { from: null, to: null, error: 'from must not be after to' }
  return { from, to }
}

/** `created_since` as an ISO timestamp — lets a client sync incrementally. */
export function parseCreatedSince(url: URL): { createdSince: string | null; error?: string } {
  const raw = url.searchParams.get('created_since')
  if (!raw) return { createdSince: null }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return { createdSince: null, error: 'created_since must be an ISO-8601 timestamp' }
  return { createdSince: d.toISOString() }
}

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 1000

/** `limit` (1–1000, default 200) and `offset` (>= 0). */
export function parsePagination(url: URL): { limit: number; offset: number; error?: string } {
  const limitRaw = url.searchParams.get('limit')
  const offsetRaw = url.searchParams.get('offset')
  const limit = limitRaw ? Number(limitRaw) : DEFAULT_LIMIT
  const offset = offsetRaw ? Number(offsetRaw) : 0
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { limit: 0, offset: 0, error: `limit must be an integer between 1 and ${MAX_LIMIT}` }
  }
  if (!Number.isInteger(offset) || offset < 0) {
    return { limit: 0, offset: 0, error: 'offset must be a non-negative integer' }
  }
  return { limit, offset }
}

/** Standard envelope for list endpoints. `next_offset` is null on the last page. */
export function page<T>(rows: T[], limit: number, offset: number, total: number | null) {
  const nextOffset = offset + rows.length
  return {
    data: rows,
    pagination: {
      limit,
      offset,
      returned: rows.length,
      total,
      next_offset: total !== null && nextOffset < total ? nextOffset : null,
    },
  }
}

export function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 })
}

export function ok(body: unknown): Response {
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
