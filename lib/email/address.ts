// Shared email-address handling for the party records and for the Ask
// "email this answer" recipient box. Kept free of server-only imports so a
// client form can validate the same way the action does.

import { z } from 'zod'

/** How many addresses one Ask answer may be sent to at once. */
export const MAX_RECIPIENTS = 5

/**
 * An optional contact address on a customer / supplier. A blank box means "no
 * email on file", which is stored as null rather than '' so the recipient
 * picker can tell an unset address from an empty one.
 */
export const optionalEmailField = z
  .string()
  .trim()
  .email('Enter a valid email address')
  .or(z.literal(''))
  .optional()

/** '' / undefined → null, so a cleared field really clears the column. */
export function toStoredEmail(value: string | undefined): string | null {
  const v = (value ?? '').trim()
  return v === '' ? null : v.toLowerCase()
}

const ONE_ADDRESS = z.string().trim().email()

/**
 * Split a typed recipient box ("a@b.com, c@d.com") into addresses.
 * Rejects the whole list on the first bad address rather than silently
 * dropping it — a half-sent email is worse than a refused one.
 */
export function parseRecipients(raw: string): { emails: string[] } | { error: string } {
  const parts = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (parts.length === 0) return { error: 'Enter at least one email address' }
  if (parts.length > MAX_RECIPIENTS) {
    return { error: `Send to at most ${MAX_RECIPIENTS} addresses at a time` }
  }

  const bad = parts.find((p) => !ONE_ADDRESS.safeParse(p).success)
  if (bad) return { error: `"${bad}" is not a valid email address` }

  // De-duplicate case-insensitively so the same person is not mailed twice.
  const seen = new Set<string>()
  const emails: string[] = []
  for (const p of parts) {
    const lower = p.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    emails.push(lower)
  }
  return { emails }
}
