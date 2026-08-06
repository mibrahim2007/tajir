// Turn an already-computed Ask answer into a sent email.
//
// Server-only: pulls in ExcelJS and the mail client. It exists as a separate
// module because two callers need it and they get the answer differently —
// `emailAskAnswerAction` re-runs the question (it cannot trust a browser for
// the figures), while `askAction` already holds a freshly-computed answer from
// a typed "email me …" command and would otherwise run the same query twice.

import { getTenant } from '@/lib/auth/get-tenant'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { isEmailable, type AskResponse } from '@/lib/ask/types'
import { askAttachmentName, buildAskWorkbook, renderAskEmailHtml, renderAskEmailText } from '@/lib/ask/email-format'
import { sendDataEmail } from '@/lib/email/send-email'
import { MAX_RECIPIENTS, parseRecipients } from '@/lib/email/address'
import type { ActionResult } from '@/lib/types'

export type EmailTarget = 'me' | 'party' | 'other'

export type SendAskAnswerParams = {
  response: AskResponse
  /** The data question, with any email directive already stripped. */
  question: string
  target: EmailTarget
  /** Raw recipient text; only read when target is 'other'. */
  to?: string
  note?: string
  user: { id: string; email?: string }
  tenantId: string
}

export async function sendAskAnswer(params: SendAskAnswerParams): Promise<ActionResult<{ to: string[] }>> {
  const { response, question, target, to, note, user, tenantId } = params

  if (!isEmailable(response)) {
    return {
      success: false,
      error: 'There is no data in that answer to send. Ask for a ledger, a summary or a list first.',
      code: 'NOT_EMAILABLE',
    }
  }

  // ── Resolve recipients ────────────────────────────────────────────
  let recipients: string[]
  if (target === 'me') {
    if (!user.email) {
      return { success: false, error: 'Your account has no email address on file.', code: 'NO_SENDER_EMAIL' }
    }
    recipients = [user.email.toLowerCase()]
  } else if (target === 'party') {
    // Taken off the freshly-computed answer, never off anything the browser
    // sent — "send it to the customer" can only reach the address recorded
    // against that customer.
    const partyEmail = response.party?.email
    if (!partyEmail) {
      return {
        success: false,
        error: `No email address is on file for ${response.party?.name ?? 'that party'}. Add one on their record first.`,
        code: 'NO_PARTY_EMAIL',
      }
    }
    recipients = [partyEmail.toLowerCase()]
  } else {
    const parsed = parseRecipients(to ?? '')
    if ('error' in parsed) return { success: false, error: parsed.error, code: 'VALIDATION_ERROR' }
    recipients = parsed.emails
  }

  if (recipients.length > MAX_RECIPIENTS) {
    return { success: false, error: `Send to at most ${MAX_RECIPIENTS} addresses at a time`, code: 'VALIDATION_ERROR' }
  }

  // ── Render and send ───────────────────────────────────────────────
  const tenant = await getTenant(tenantId)
  const attachment = await buildAskWorkbook(response, question)
  const attachmentName = attachment ? askAttachmentName(response) : undefined

  const opts = { response, question, tenantName: tenant.name, senderEmail: user.email, note, attachmentName }
  const title = 'title' in response && response.title ? response.title : question

  const send = await sendDataEmail({
    to: recipients,
    subject: `${title} — ${tenant.name}`,
    html: renderAskEmailHtml(opts),
    text: renderAskEmailText(opts),
    // Sent as the person who pressed Send when their address is on a verified
    // sending domain; otherwise as the app, still labelled with the tenant.
    fromUserEmail: user.email,
    fromName: tenant.name,
    // Replies go to the person who pressed Send, not to the sending domain.
    replyTo: user.email,
    attachments: attachment && attachmentName ? [{ filename: attachmentName, content: attachment }] : undefined,
  })

  if (!send.ok) return { success: false, error: send.error, code: 'EMAIL_FAILED' }

  await createAuditEntry({
    tenantId,
    userId: user.id,
    action: 'email',
    entity: 'ask_answer',
    after: { question, title, recipients, target, attachment: attachmentName ?? null },
  })

  return { success: true, data: { to: recipients } }
}
