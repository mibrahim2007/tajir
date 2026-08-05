// Render an Ask answer as an email: an inline-styled HTML body plus the same
// data as a spreadsheet attachment.
//
// Two rules shape this file:
//  1. Mail clients strip <style> blocks and ignore most modern CSS, so every
//     rule is an inline `style` attribute on a table — the layout a 2005 email
//     client would accept. No Tailwind, no classes, no flexbox.
//  2. Every value that reaches the HTML is escaped. Rows carry party names,
//     item names and voucher descriptions typed by the user, and an email body
//     is rendered somewhere we do not control.
//
// Numbers are formatted exactly as the chat formats them (same `kind` switch)
// so the email cannot disagree with the answer on screen.

import ExcelJS from 'exceljs'
import { formatPKR } from '@/lib/utils/currency'
import type { AskResponse, AskColumn, AskTable, AskStats } from '@/lib/ask/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtDate(v: unknown): string {
  if (!v) return '—'
  const s = String(v).slice(0, 10)
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return String(v)
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`
}

/** Mirrors `cell()` in ask-chat.tsx — keep the two in step. */
function cell(value: string | number | null, kind?: AskColumn['kind']): string {
  if (value === null || value === undefined || value === '') return '—'
  switch (kind) {
    case 'money':  return formatPKR(Number(value))
    case 'qty':    return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
    case 'number': return String(value)
    case 'date':   return fmtDate(value)
    default:       return String(value)
  }
}

const isRight = (k?: AskColumn['kind']) => k === 'money' || k === 'qty' || k === 'number'

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Palette ─────────────────────────────────────────────────────────
// Fixed light-mode colours: an email cannot follow the app's theme, and a
// dark-on-dark table is unreadable in the clients that force a light body.
const INK = '#111827'
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'
const HEAD_BG = '#f9fafb'
const BRAND = '#0f766e'

// ── HTML ────────────────────────────────────────────────────────────

function tableHtml(r: AskTable): string {
  const head = r.columns
    .map(
      (c) =>
        `<th style="padding:8px 10px;border-bottom:1px solid ${BORDER};font:600 11px/1.4 Arial,sans-serif;` +
        `letter-spacing:.04em;text-transform:uppercase;color:${MUTED};text-align:${isRight(c.kind) ? 'right' : 'left'};` +
        `white-space:nowrap">${escapeHtml(c.label)}</th>`,
    )
    .join('')

  const body = r.rows
    .map((row, i) => {
      const cells = r.columns
        .map(
          (c) =>
            `<td style="padding:8px 10px;border-bottom:1px solid ${BORDER};font:400 13px/1.5 Arial,sans-serif;` +
            `color:${INK};text-align:${isRight(c.kind) ? 'right' : 'left'}${
              // Amounts and dates must never break mid-value: a wrapped
              // "-Rs 2,400.00" puts the minus sign on its own line and reads
              // as a positive number. Free text still wraps.
              isRight(c.kind) || c.kind === 'date' ? ';white-space:nowrap' : ''
            }">${escapeHtml(cell(row[c.key], c.kind))}</td>`,
        )
        .join('')
      // Zebra striping survives clients that drop :nth-child.
      return `<tr${i % 2 ? ` style="background:${HEAD_BG}"` : ''}>${cells}</tr>`
    })
    .join('')

  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ` +
    `style="border-collapse:collapse;width:100%;border:1px solid ${BORDER};border-radius:6px">` +
    `<thead><tr style="background:${HEAD_BG}">${head}</tr></thead><tbody>${body}</tbody></table>`
  )
}

function statsHtml(r: AskStats): string {
  // Two per row: a 3-column grid collapses badly on a phone mail client.
  const cells = r.stats.map(
    (s) =>
      `<td width="50%" style="padding:6px">` +
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ` +
      `style="border-collapse:collapse;border:1px solid ${BORDER};border-radius:6px"><tr><td style="padding:10px 12px">` +
      `<div style="font:600 10px/1.4 Arial,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:${MUTED}">` +
      `${escapeHtml(s.label)}</div>` +
      `<div style="font:700 15px/1.4 Arial,sans-serif;color:${s.tone === 'negative' ? '#b91c1c' : s.tone === 'positive' ? '#047857' : INK};padding-top:2px">` +
      `${escapeHtml(s.value)}</div>` +
      `</td></tr></table></td>`,
  )

  const rows: string[] = []
  for (let i = 0; i < cells.length; i += 2) {
    // Pad the last row so the final tile does not stretch to full width.
    const pair = cells.slice(i, i + 2)
    if (pair.length === 1) pair.push('<td width="50%"></td>')
    rows.push(`<tr>${pair.join('')}</tr>`)
  }

  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ` +
    `style="border-collapse:collapse;width:100%">${rows.join('')}</table>`
  )
}

export type AskEmailOpts = {
  response: AskResponse
  /** The question as typed, shown so the recipient knows what was asked. */
  question: string
  tenantName: string
  /** Who asked for it — the reply-to human, not the sending domain. */
  senderEmail?: string
  /** Optional free-text note typed into the send dialog. */
  note?: string
  /** Name of the spreadsheet attached alongside, if any. */
  attachmentName?: string
}

export function renderAskEmailHtml(opts: AskEmailOpts): string {
  const r = opts.response
  const title = 'title' in r && r.title ? r.title : opts.question
  const subtitle = 'subtitle' in r && r.subtitle ? r.subtitle : ''
  const summary = 'summary' in r && r.summary ? r.summary : ''
  const footer = r.kind === 'table' && r.footer ? r.footer : ''

  const parts: string[] = []

  parts.push(
    `<tr><td style="padding:20px 24px 0">` +
      `<div style="font:700 13px/1.4 Arial,sans-serif;color:${BRAND};letter-spacing:.02em">${escapeHtml(opts.tenantName)}</div>` +
      `<h1 style="margin:6px 0 0;font:700 19px/1.35 Arial,sans-serif;color:${INK}">${escapeHtml(title)}</h1>` +
      (subtitle
        ? `<div style="font:400 12px/1.5 Arial,sans-serif;color:${MUTED};padding-top:3px">${escapeHtml(subtitle)}</div>`
        : '') +
      `</td></tr>`,
  )

  if (opts.note?.trim()) {
    parts.push(
      `<tr><td style="padding:16px 24px 0">` +
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">` +
        `<tr><td style="padding:10px 14px;background:${HEAD_BG};border-left:3px solid ${BRAND};border-radius:4px;` +
        `font:400 13px/1.6 Arial,sans-serif;color:${INK};white-space:pre-wrap">${escapeHtml(opts.note.trim())}</td></tr>` +
        `</table></td></tr>`,
    )
  }

  if (summary) {
    parts.push(
      `<tr><td style="padding:14px 24px 0;font:400 14px/1.6 Arial,sans-serif;color:${INK}">${escapeHtml(summary)}</td></tr>`,
    )
  }

  if (r.kind === 'table') {
    parts.push(`<tr><td style="padding:14px 24px 0">${tableHtml(r)}</td></tr>`)
    if (footer) {
      parts.push(
        `<tr><td style="padding:10px 24px 0;text-align:right;font:700 14px/1.5 Arial,sans-serif;color:${INK}">${escapeHtml(footer)}</td></tr>`,
      )
    }
  } else if (r.kind === 'stats') {
    parts.push(`<tr><td style="padding:14px 18px 0">${statsHtml(r)}</td></tr>`)
  } else if (r.kind === 'text') {
    parts.push(
      `<tr><td style="padding:14px 24px 0;font:400 14px/1.6 Arial,sans-serif;color:${INK};white-space:pre-wrap">${escapeHtml(r.body)}</td></tr>`,
    )
  }

  const provenance =
    `Asked in Tajir: “${escapeHtml(opts.question)}”` +
    (opts.senderEmail ? ` · sent by ${escapeHtml(opts.senderEmail)}` : '') +
    (opts.attachmentName ? ` · spreadsheet attached (${escapeHtml(opts.attachmentName)})` : '')

  parts.push(
    `<tr><td style="padding:22px 24px 24px">` +
      `<div style="border-top:1px solid ${BORDER};padding-top:12px;font:400 11px/1.6 Arial,sans-serif;color:${MUTED}">` +
      `${provenance}<br/>Figures come straight from recorded transactions — nothing is estimated.` +
      `</div></td></tr>`,
  )

  return (
    `<div style="background:#f3f4f6;padding:20px 0;font-family:Arial,Helvetica,sans-serif">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">` +
    `<tr><td align="center">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" ` +
    `style="border-collapse:collapse;width:640px;max-width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:8px">` +
    parts.join('') +
    `</table></td></tr></table></div>`
  )
}

/** Plain-text alternative, for clients that refuse HTML. */
export function renderAskEmailText(opts: AskEmailOpts): string {
  const r = opts.response
  const lines: string[] = []
  if ('title' in r && r.title) lines.push(r.title)
  if ('subtitle' in r && r.subtitle) lines.push(r.subtitle)
  lines.push('')
  if (opts.note?.trim()) lines.push(opts.note.trim(), '')
  if ('summary' in r && r.summary) lines.push(r.summary, '')

  if (r.kind === 'table') {
    lines.push(r.columns.map((c) => c.label).join(' | '))
    for (const row of r.rows) lines.push(r.columns.map((c) => cell(row[c.key], c.kind)).join(' | '))
    if (r.footer) lines.push('', r.footer)
  } else if (r.kind === 'stats') {
    for (const s of r.stats) lines.push(`${s.label}: ${s.value}`)
  } else if (r.kind === 'text') {
    lines.push(r.body)
  }

  lines.push('', `Asked in Tajir: "${opts.question}"`)
  if (opts.attachmentName) lines.push(`Spreadsheet attached: ${opts.attachmentName}`)
  return lines.join('\n')
}

// ── Spreadsheet ─────────────────────────────────────────────────────

/** Excel caps a sheet name at 31 chars and rejects : \ / ? * [ ]. */
function safeSheetName(title: string): string {
  const cleaned = title.replace(/[:\\/?*[\]]/g, ' ').trim()
  return cleaned.slice(0, 31) || 'Answer'
}

/** `star-technologies-ledger.xlsx` — recognisable in a downloads folder. */
export function askAttachmentName(response: AskResponse): string {
  const title = ('title' in response && response.title) || 'ask-answer'
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'ask-answer'}.xlsx`
}

/**
 * The same answer as a workbook. Money and quantity columns are written as real
 * numbers with a display format — not pre-formatted strings — so the recipient
 * can sum and sort them.
 */
export async function buildAskWorkbook(response: AskResponse, question: string): Promise<Buffer | null> {
  if (response.kind !== 'table' && response.kind !== 'stats') return null

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Tajir'
  const title = ('title' in response && response.title) || 'Answer'
  const sheet = workbook.addWorksheet(safeSheetName(title))

  if (response.kind === 'table') {
    sheet.columns = response.columns.map((c) => ({
      header: c.label,
      key: c.key,
      width: c.kind === 'money' ? 18 : c.kind === 'date' ? 14 : Math.min(Math.max(c.label.length + 6, 12), 44),
    }))
    sheet.getRow(1).font = { bold: true }

    for (const row of response.rows) {
      const out: Record<string, string | number | null> = {}
      for (const c of response.columns) {
        const v = row[c.key]
        // Dates stay as the stored ISO string: Excel parses yyyy-mm-dd itself,
        // and re-formatting here would only lose the sort order.
        out[c.key] =
          (c.kind === 'money' || c.kind === 'qty' || c.kind === 'number') && v !== null && v !== ''
            ? Number(v)
            : (v as string | number | null)
      }
      sheet.addRow(out)
    }

    response.columns.forEach((c, i) => {
      if (c.kind === 'money') sheet.getColumn(i + 1).numFmt = '#,##0.00'
      else if (c.kind === 'qty') sheet.getColumn(i + 1).numFmt = '#,##0.000'
    })

    if (response.footer) {
      sheet.addRow([])
      sheet.addRow([response.footer]).font = { bold: true }
    }
  } else {
    sheet.columns = [
      { header: 'Measure', key: 'label', width: 32 },
      { header: 'Value', key: 'value', width: 28 },
    ]
    sheet.getRow(1).font = { bold: true }
    // Stat values are already display strings (e.g. "PKR 45,000 (owes you)"),
    // so they go across as text — there is no underlying number to recover.
    for (const s of response.stats) sheet.addRow({ label: s.label, value: s.value })
  }

  sheet.addRow([])
  sheet.addRow([`Asked in Tajir: ${question}`]).font = { italic: true, size: 9 }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
