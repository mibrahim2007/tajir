// Which From address a user-initiated email goes out as.
//
// The intent is that an email carries the address of whoever pressed Send. The
// hard limit is the provider: Resend only accepts a From on a domain verified
// against the account, and refuses everything else — that refusal is exactly
// what domain verification exists for, and it is why nobody can send as
// gmail.com. A tenant address like admin@ibrahimshop.com is therefore not a
// usable sender however well-formed it is.
//
// So "valid" here means valid AS A SENDER: well-formed AND on a domain we are
// allowed to send from. Anything else falls back to FALLBACK_SENDER. Either
// way the reply-to is set to the real person, so replies reach them.

import { z } from 'zod'

/** Used when the signed-in user's address cannot be sent from. */
export const FALLBACK_SENDER = 'tajirapp@jappx.com'

const ADDRESS = z.string().trim().email()

/**
 * Domains verified in Resend, lowest-common-denominator 'jappx.com'.
 *
 * Overridable so that verifying another domain is a config change rather than
 * a deploy: RESEND_SENDING_DOMAINS="jappx.com,tajir.app".
 */
export function sendingDomains(): string[] {
  const raw = process.env.RESEND_SENDING_DOMAINS || 'jappx.com'
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
}

/** True when `email` can actually be used as a From address. */
export function isSendableFrom(email: string | null | undefined): boolean {
  const parsed = ADDRESS.safeParse(email ?? '')
  if (!parsed.success) return false
  const domain = parsed.data.toLowerCase().split('@')[1]
  return sendingDomains().includes(domain)
}

/**
 * Display names go into a mail header, so a stray quote or newline would let
 * the name break out of it and inject headers of its own. Strip both, and cap
 * the length while we are here — tenant names are user-supplied.
 */
function safeDisplayName(name: string | null | undefined): string {
  return (name ?? '')
    .replace(/[\r\n"\\<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}

/** The configured fallback, or the built-in one. See RESEND_FROM_EMAIL. */
function fallbackFrom(): string {
  return process.env.RESEND_FROM_EMAIL || `Tajir <${FALLBACK_SENDER}>`
}

/**
 * Work out the From header for a user-initiated send.
 *
 * When the signed-in address is sendable it is used as-is. When it is not, the
 * mail goes out as the fallback but keeps the human in the display name
 * ("Ibrahim Mobile Shop via Tajir"), so the recipient still sees who it is
 * from rather than an anonymous system address.
 */
export function resolveFrom(opts: {
  userEmail?: string | null
  displayName?: string | null
}): string {
  const name = safeDisplayName(opts.displayName)

  if (isSendableFrom(opts.userEmail)) {
    const address = (opts.userEmail as string).trim().toLowerCase()
    return name ? `"${name}" <${address}>` : address
  }

  const fallback = fallbackFrom()
  if (!name) return fallback

  // Keep whatever address the fallback carries, relabelled for this sender.
  const address = fallback.match(/<([^>]+)>/)?.[1] ?? fallback
  return `"${name} via Tajir" <${address.trim()}>`
}
