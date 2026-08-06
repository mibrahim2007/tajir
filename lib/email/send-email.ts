import { Resend } from 'resend'
import { resolveFrom } from './sender'

// Where support-ticket notifications land. Any address works — a RECIPIENT
// domain needs no verification, unlike the sender below.
const ADMIN_EMAIL = 'aamerjamil@gmail.com'

// System mail (ticket notifications) is from the app itself, so it always goes
// out as the configured address. User-initiated mail resolves its own From from
// the signed-in user — see resolveFrom, and the sender rules it documents.
//
// `||`, not `??`: an env var that exists but is blank is the common way this
// goes wrong (declared in the dashboard, value never filled in). `??` would
// keep the empty string and every send would fail at the provider with an
// unhelpful "invalid from address"; `||` falls back to something valid.
const FROM_EMAIL  = process.env.RESEND_FROM_EMAIL || 'Tajir <tajirapp@jappx.com>'

let _resend: Resend | null = null
function getResend() {
  if (!process.env.RESEND_API_KEY) return null
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

/** True when RESEND_API_KEY is set, i.e. sending can actually happen. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

export type SendResult = { ok: true } | { ok: false; error: string }

/**
 * Send a user-initiated email and report whether it worked.
 *
 * The notify* helpers below are fire-and-forget: a failed ticket notification
 * must not fail the ticket. This one is different — someone pressed "Send" and
 * is waiting to hear, so the outcome is returned rather than swallowed.
 */
export async function sendDataEmail(opts: {
  to: string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  /** The signed-in user's address; used as the From when it is sendable. */
  fromUserEmail?: string
  /** Shown alongside the address, e.g. the tenant's name. */
  fromName?: string
  attachments?: { filename: string; content: Buffer }[]
}): Promise<SendResult> {
  const resend = getResend()
  if (!resend) {
    return { ok: false, error: 'Email is not configured on this server (RESEND_API_KEY is not set).' }
  }
  try {
    const { error } = await resend.emails.send({
      from: resolveFrom({ userEmail: opts.fromUserEmail, displayName: opts.fromName }),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      ...(opts.attachments?.length
        ? { attachments: opts.attachments.map((a) => ({ filename: a.filename, content: a.content })) }
        : {}),
    })
    // Resend reports delivery refusals in `error` rather than by throwing —
    // returning ok:true here would tell the user it was sent when it was not.
    if (error) {
      console.error('[email] sendDataEmail rejected:', error)
      return { ok: false, error: error.message || 'The mail provider rejected the message.' }
    }
    return { ok: true }
  } catch (e) {
    console.error('[email] sendDataEmail failed:', e)
    return { ok: false, error: 'Could not reach the mail service. Try again in a moment.' }
  }
}

export async function notifyAdminNewTicket(opts: {
  ticketId: string
  tenantName: string
  userEmail: string
  subject: string
  message: string
}) {
  const resend = getResend()
  if (!resend) return
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `[New Ticket] ${opts.subject} — ${opts.tenantName}`,
      html: `
        <p><strong>New support ticket submitted</strong></p>
        <p><strong>Tenant:</strong> ${opts.tenantName}</p>
        <p><strong>User:</strong> ${opts.userEmail}</p>
        <p><strong>Subject:</strong> ${opts.subject}</p>
        <hr/>
        <p>${opts.message.replace(/\n/g, '<br/>')}</p>
        <p><a href="https://tajir.jappx.com/admin/support/${opts.ticketId}">View & Reply →</a></p>
      `,
    })
  } catch (e) {
    console.error('[email] notifyAdminNewTicket failed:', e)
  }
}

export async function notifyAdminNewReply(opts: {
  ticketId: string
  tenantName: string
  userEmail: string
  subject: string
  message: string
}) {
  const resend = getResend()
  if (!resend) return
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `[Re: ${opts.subject}] New reply from ${opts.tenantName}`,
      html: `
        <p><strong>New reply on support ticket</strong></p>
        <p><strong>Tenant:</strong> ${opts.tenantName}</p>
        <p><strong>User:</strong> ${opts.userEmail}</p>
        <hr/>
        <p>${opts.message.replace(/\n/g, '<br/>')}</p>
        <p><a href="https://tajir.jappx.com/admin/support/${opts.ticketId}">View & Reply →</a></p>
      `,
    })
  } catch (e) {
    console.error('[email] notifyAdminNewReply failed:', e)
  }
}

export async function notifyUserStaffReply(opts: {
  ticketId: string
  userEmail: string
  subject: string
  message: string
}) {
  const resend = getResend()
  if (!resend) return
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: opts.userEmail,
      subject: `Re: ${opts.subject} — Tajir Support`,
      html: `
        <p>Hi,</p>
        <p>Our support team has replied to your ticket: <strong>${opts.subject}</strong></p>
        <hr/>
        <p>${opts.message.replace(/\n/g, '<br/>')}</p>
        <hr/>
        <p><a href="https://tajir.jappx.com/support/${opts.ticketId}">View full conversation →</a></p>
        <p style="color:#888;font-size:12px">Tajir Support · tajir.jappx.com</p>
      `,
    })
  } catch (e) {
    console.error('[email] notifyUserStaffReply failed:', e)
  }
}
