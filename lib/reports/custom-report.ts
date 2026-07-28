import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchLedgerTotals } from './ledger-totals'

// Engine for user-defined financial statements.
//
// A definition (custom_reports + custom_report_lines + custom_report_line_accounts)
// says WHICH reporting headers to print, WHICH GL account codes roll into each
// one, and HOW each line behaves. This module turns that definition plus a date
// range into printable rows.
//
// It reads the ledger through fetchLedgerTotals — the same aggregation the P&L,
// Balance Sheet and Trial Balance use — so a custom "Revenue" header and the
// standard P&L can never disagree about the same accounts.

export const LINE_TYPES = ['header', 'accounts', 'subtotal', 'spacer'] as const
export type LineType = (typeof LINE_TYPES)[number]

export const SIGNS = ['natural', 'credit_positive'] as const
export type Sign = (typeof SIGNS)[number]

export const BASES = ['period', 'as_of'] as const
export type Basis = (typeof BASES)[number]

export type ReportDefinition = {
  id: string
  name: string
  description: string | null
  basis: Basis
  hideZeroRows: boolean
  lines: LineDefinition[]
}

export type LineDefinition = {
  id: string
  sortOrder: number
  lineType: LineType
  label: string
  ref: string | null
  indent: number
  sign: Sign
  includeChildren: boolean
  showDetail: boolean
  isBold: boolean
  underline: boolean
  formula: string | null
  /** Account codes mapped to this line (only meaningful for lineType 'accounts'). */
  accountCodes: string[]
}

/**
 * Loads one saved definition, scoped to the tenant. Returns null when the id
 * belongs to another tenant, so a guessed uuid leaks nothing.
 */
export async function fetchReportDefinition(params: {
  admin: SupabaseClient
  tenantId: string
  reportId: string
}): Promise<ReportDefinition | null> {
  const { admin, tenantId, reportId } = params

  const { data: report } = await admin
    .from('custom_reports')
    .select('id, name, description, basis, hide_zero_rows')
    .eq('tenant_id', tenantId)
    .eq('id', reportId)
    .maybeSingle()

  if (!report) return null

  const { data: rawLines } = await admin
    .from('custom_report_lines')
    .select('id, sort_order, line_type, label, ref, indent, sign, include_children, show_detail, is_bold, underline, formula')
    .eq('report_id', reportId)
    .order('sort_order')

  const lineIds = (rawLines ?? []).map((l) => l.id as string)
  const codesByLine = new Map<string, string[]>()
  if (lineIds.length > 0) {
    const { data: mapped } = await admin
      .from('custom_report_line_accounts')
      .select('line_id, account_code')
      .in('line_id', lineIds)
    for (const row of mapped ?? []) {
      const list = codesByLine.get(row.line_id as string) ?? []
      list.push(row.account_code as string)
      codesByLine.set(row.line_id as string, list)
    }
  }

  return {
    id: report.id as string,
    name: report.name as string,
    description: (report.description as string | null) ?? null,
    basis: report.basis as Basis,
    hideZeroRows: report.hide_zero_rows as boolean,
    lines: (rawLines ?? []).map((l) => ({
      id: l.id as string,
      sortOrder: l.sort_order as number,
      lineType: l.line_type as LineType,
      label: l.label as string,
      ref: (l.ref as string | null) ?? null,
      indent: l.indent as number,
      sign: l.sign as Sign,
      includeChildren: l.include_children as boolean,
      showDetail: l.show_detail as boolean,
      isBold: l.is_bold as boolean,
      underline: l.underline as boolean,
      formula: (l.formula as string | null) ?? null,
      accountCodes: (codesByLine.get(l.id as string) ?? []).sort(),
    })),
  }
}

/** One printed row. `kind` drives styling, not arithmetic. */
export type RenderedRow = {
  key: string
  kind: LineType | 'detail'
  label: string
  /** Account code, on detail rows only. */
  code?: string
  indent: number
  amount: number | null
  isBold: boolean
  underline: boolean
  /** Set when a subtotal's formula could not be evaluated. */
  error?: string
}

export type RenderedReport = {
  rows: RenderedRow[]
  /** Accounts posted to in the period that no line picked up. Never silently dropped. */
  unmapped: { code: string; name: string; amount: number }[]
  hasData: boolean
}

type Account = {
  id: string; code: string; name: string; account_type: string
  parent_code: string | null; is_header: boolean; is_active: boolean
}

/**
 * Expands each mapped code to itself plus, when `includeChildren`, every
 * descendant in the parent_code tree. Header accounts are never posted to, so
 * mapping "4000 Revenue" with roll-up is how a user selects a whole branch.
 */
function expandCodes(codes: string[], includeChildren: boolean, childrenByParent: Map<string, string[]>): Set<string> {
  const out = new Set<string>()
  const walk = (code: string) => {
    if (out.has(code)) return
    out.add(code)
    if (!includeChildren) return
    for (const child of childrenByParent.get(code) ?? []) walk(child)
  }
  for (const code of codes) walk(code)
  return out
}

/**
 * Evaluates a subtotal formula: refs, numbers, `+`, `-`, and parentheses-free
 * left-to-right arithmetic. Deliberately not a general expression language —
 * a statement subtotal is always a sum of other lines, and keeping it to +/-
 * means a typo produces a clear error instead of a plausible wrong number.
 */
export function evaluateFormula(formula: string, valueByRef: Map<string, number>): { value: number } | { error: string } {
  const tokens = formula.replace(/([+-])/g, ' $1 ').trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { error: 'Formula is empty' }

  let total = 0
  let sign = 1
  let expectOperand = true

  for (const token of tokens) {
    if (token === '+' || token === '-') {
      if (expectOperand) return { error: `Unexpected "${token}"` }
      sign = token === '+' ? 1 : -1
      expectOperand = true
      continue
    }
    if (!expectOperand) return { error: `Missing + or - before "${token}"` }

    if (/^\d+(\.\d+)?$/.test(token)) {
      total += sign * Number(token)
    } else {
      const value = valueByRef.get(token.toUpperCase())
      if (value === undefined) return { error: `Unknown reference "${token}"` }
      total += sign * value
    }
    expectOperand = false
  }

  if (expectOperand) return { error: 'Formula ends with an operator' }
  return { value: total }
}

/**
 * Computes a saved definition against the ledger.
 *
 * `from` is ignored for an 'as_of' report — a balance-style statement is always
 * cumulative to the closing date, exactly as the Balance Sheet does it.
 */
export async function computeCustomReport(params: {
  admin: SupabaseClient
  tenantId: string
  definition: ReportDefinition
  from: string
  to: string
}): Promise<RenderedReport> {
  const { admin, tenantId, definition, from, to } = params

  const [{ data: rawAccounts, error: accErr }, totals] = await Promise.all([
    admin.from('chart_of_accounts')
      .select('id, code, name, account_type, parent_code, is_header, is_active')
      .eq('tenant_id', tenantId)
      .order('code'),
    fetchLedgerTotals({
      admin,
      tenantId,
      from: definition.basis === 'period' ? from : undefined,
      to,
    }),
  ])

  if (accErr) throw new Error(`Could not load chart of accounts: ${accErr.message}`)

  const accounts = (rawAccounts ?? []) as Account[]
  const byCode = new Map(accounts.map((a) => [a.code, a]))
  const childrenByParent = new Map<string, string[]>()
  for (const a of accounts) {
    if (!a.parent_code) continue
    const list = childrenByParent.get(a.parent_code) ?? []
    list.push(a.code)
    childrenByParent.set(a.parent_code, list)
  }

  const netOf = (code: string): number => {
    const acc = byCode.get(code)
    if (!acc) return 0
    return totals.byAccount.get(acc.id)?.net ?? 0
  }

  const rows: RenderedRow[] = []
  const valueByRef = new Map<string, number>()
  const consumed = new Set<string>()
  const lines = [...definition.lines].sort((a, b) => a.sortOrder - b.sortOrder)

  for (const line of lines) {
    if (line.lineType === 'spacer') {
      rows.push({ key: line.id, kind: 'spacer', label: '', indent: 0, amount: null, isBold: false, underline: false })
      continue
    }

    if (line.lineType === 'header') {
      rows.push({
        key: line.id, kind: 'header', label: line.label, indent: line.indent,
        amount: null, isBold: true, underline: line.underline,
      })
      continue
    }

    if (line.lineType === 'subtotal') {
      const result = evaluateFormula(line.formula ?? '', valueByRef)
      const amount = 'value' in result ? result.value : 0
      if ('value' in result && line.ref) valueByRef.set(line.ref.toUpperCase(), amount)
      rows.push({
        key: line.id, kind: 'subtotal', label: line.label, indent: line.indent,
        amount, isBold: line.isBold, underline: line.underline,
        ...('error' in result ? { error: result.error } : {}),
      })
      continue
    }

    // 'accounts' — the reporting header the user mapped codes to.
    const codes = expandCodes(line.accountCodes, line.includeChildren, childrenByParent)
    const flip = line.sign === 'credit_positive' ? -1 : 1

    const contributing: { code: string; name: string; amount: number }[] = []
    let total = 0
    for (const code of codes) {
      const acc = byCode.get(code)
      if (!acc) continue
      consumed.add(code)
      // Header accounts hold no postings of their own; skipping them keeps a
      // rolled-up branch from double counting if one were ever posted to.
      if (acc.is_header) continue
      const amount = netOf(code) * flip
      total += amount
      if (amount !== 0) contributing.push({ code, name: acc.name, amount })
    }

    if (line.ref) valueByRef.set(line.ref.toUpperCase(), total)

    const isZero = total === 0 && contributing.length === 0
    if (definition.hideZeroRows && isZero) continue

    rows.push({
      key: line.id, kind: 'accounts', label: line.label, indent: line.indent,
      amount: total, isBold: line.isBold, underline: line.underline,
    })

    if (line.showDetail) {
      for (const detail of contributing.sort((a, b) => a.code.localeCompare(b.code))) {
        rows.push({
          key: `${line.id}:${detail.code}`, kind: 'detail', label: detail.name, code: detail.code,
          indent: line.indent + 1, amount: detail.amount, isBold: false, underline: false,
        })
      }
    }
  }

  // Anything posted to but not mapped anywhere. Surfaced rather than dropped:
  // a statement that silently omits an account is worse than one that says so.
  const unmapped: { code: string; name: string; amount: number }[] = []
  for (const acc of accounts) {
    if (consumed.has(acc.code)) continue
    const net = totals.byAccount.get(acc.id)?.net ?? 0
    if (net === 0) continue
    unmapped.push({ code: acc.code, name: acc.name, amount: net })
  }

  return { rows, unmapped, hasData: totals.hasAny }
}
