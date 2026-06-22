import { Resend } from 'resend'

const ADMIN_EMAIL = 'tajiradmin@tajir.app'
const FROM_EMAIL  = process.env.RESEND_FROM_EMAIL ?? 'Tajir Support <support@tajir.app>'

let _resend: Resend | null = null
function getResend() {
  if (!process.env.RESEND_API_KEY) return null
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
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
