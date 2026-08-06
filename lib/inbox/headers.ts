// Header handling for fetched mail. Kept apart from ./imap so it carries no
// server-only or IMAP-client imports and can be checked directly.

/**
 * ImapFlow hands back the requested header lines as a raw Buffer, not a map,
 * so unfold the continuations and split them ourselves.
 */
export function parseHeaders(raw: Buffer | string | undefined | null): Map<string, string> {
  const map = new Map<string, string>()
  if (!raw) return map
  const text = (typeof raw === 'string' ? raw : raw.toString('utf8'))
    // A header value may wrap onto following lines that begin with whitespace.
    .replace(/\r?\n[ \t]+/g, ' ')
  for (const line of text.split(/\r?\n/)) {
    const at = line.indexOf(':')
    if (at <= 0) continue
    map.set(line.slice(0, at).trim().toLowerCase(), line.slice(at + 1).trim())
  }
  return map
}

/** A mailing rather than a person: the headers say so outright. */
export function looksBulk(headers: Map<string, string>): boolean {
  const get = (k: string) => headers.get(k) ?? ''
  if (get('list-unsubscribe')) return true
  if (get('list-id')) return true
  if (/bulk|list|auto-generated|auto-replied/i.test(get('precedence'))) return true
  if (/bulk|list/i.test(get('x-auto-response-suppress'))) return true
  return false
}
