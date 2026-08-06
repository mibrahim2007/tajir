// Reading the last day of mail over IMAP.
//
// PROTOTYPE SCOPE: one mailbox, configured by environment variable. There is
// deliberately no per-tenant credential storage yet — that is the next step and
// wants encryption at rest and a settings screen, neither of which belongs in a
// first cut.
//
// Only envelope data is fetched (from / subject / date / flags), never message
// bodies. That is enough for the rules in ./classify and keeps the blast radius
// of a connection small: nothing readable is pulled off the server, and nothing
// is stored anywhere.

import 'server-only'
import { ImapFlow } from 'imapflow'
import { looksBulk, parseHeaders } from './headers'
import type { InboxMessage } from './classify'

export type ImapConfig = {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  mailbox: string
}

/** Reads the prototype mailbox config, or explains what is missing. */
export function readImapConfig(): { config: ImapConfig } | { error: string } {
  const host = process.env.IMAP_HOST
  const user = process.env.IMAP_USER
  const password = process.env.IMAP_PASSWORD

  const missing = [
    !host && 'IMAP_HOST',
    !user && 'IMAP_USER',
    !password && 'IMAP_PASSWORD',
  ].filter(Boolean)

  if (missing.length > 0) {
    return { error: `Mailbox is not connected on this server (${missing.join(', ')} not set).` }
  }

  const port = Number(process.env.IMAP_PORT || 993)
  return {
    config: {
      host: host as string,
      port,
      // 993 is implicit TLS; 143 upgrades with STARTTLS, which ImapFlow does
      // itself when `secure` is false.
      secure: process.env.IMAP_SECURE ? process.env.IMAP_SECURE === 'true' : port === 993,
      user: user as string,
      password: password as string,
      mailbox: process.env.IMAP_MAILBOX || 'INBOX',
    },
  }
}

/** True when any part of the structure is a real attachment. */
function hasAttachment(node: unknown): boolean {
  const n = node as { disposition?: string; childNodes?: unknown[] } | undefined
  if (!n) return false
  if (typeof n.disposition === 'string' && n.disposition.toLowerCase() === 'attachment') return true
  return Array.isArray(n.childNodes) && n.childNodes.some(hasAttachment)
}

export type FetchInboxResult =
  | { ok: true; messages: InboxMessage[]; mailbox: string; since: string }
  | { ok: false; error: string }

/**
 * Fetch messages received in the last `hours` (default 24).
 *
 * The IMAP SINCE search has date, not time, granularity, so it is asked for
 * yesterday onward and the exact cutoff is applied here.
 */
export async function fetchRecentMessages(hours = 24): Promise<FetchInboxResult> {
  const configured = readImapConfig()
  if ('error' in configured) return { ok: false, error: configured.error }
  const { config } = configured

  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
  // Widen by a day to cover the date-only granularity of SINCE.
  const searchSince = new Date(cutoff.getTime() - 24 * 60 * 60 * 1000)

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    logger: false,
  })

  try {
    await client.connect()
  } catch (e) {
    console.error('[inbox] connect failed:', e)
    return { ok: false, error: 'Could not connect to the mailbox. Check the host, port and credentials.' }
  }

  let lock
  try {
    lock = await client.getMailboxLock(config.mailbox)
  } catch (e) {
    console.error('[inbox] mailbox open failed:', e)
    await client.logout().catch(() => {})
    return { ok: false, error: `Could not open the "${config.mailbox}" mailbox.` }
  }

  const messages: InboxMessage[] = []

  try {
    // Search and fetch must agree on what the numbers mean, hence uid on both.
    const uids = await client.search({ since: searchSince }, { uid: true })
    if (uids && uids.length > 0) {
      for await (const msg of client.fetch(
        // Newest few hundred is plenty for a day and bounds a busy mailbox.
        uids.slice(-300),
        { envelope: true, flags: true, bodyStructure: true, headers: ['list-unsubscribe', 'list-id', 'precedence', 'x-auto-response-suppress'] },
        { uid: true },
      )) {
        const envelope = msg.envelope
        const date = envelope?.date ? new Date(envelope.date) : null
        if (!date || date < cutoff) continue

        const sender = envelope?.from?.[0]
        messages.push({
          from: (sender?.address ?? '').toLowerCase(),
          fromName: sender?.name ?? null,
          subject: envelope?.subject ?? '(no subject)',
          date: date.toISOString(),
          isBulk: looksBulk(parseHeaders(msg.headers)),
          hasAttachment: hasAttachment(msg.bodyStructure),
          unseen: !(msg.flags?.has('\\Seen') ?? false),
        })
      }
    }
  } catch (e) {
    console.error('[inbox] fetch failed:', e)
    return { ok: false, error: 'Connected, but could not read the messages.' }
  } finally {
    lock.release()
    await client.logout().catch(() => {})
  }

  return { ok: true, messages, mailbox: config.mailbox, since: cutoff.toISOString() }
}
