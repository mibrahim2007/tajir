// Custom report engine check — run with `npm run check:custom-report`.
//
// The failure mode this guards against is silent: a user-built "Profit & Loss"
// that prints a different net profit than the built-in P&L report would make
// every statement in the app untrustworthy. So the check runs the custom-report
// engine over the Profit & Loss template and asserts, on live tenant data, that
// it lands on the same numbers as lib/reports/profit-loss.
//
// It also round-trips a definition through the database (save → load → compute
// → delete) to prove persistence and the account-code mapping work.

import { createAdminClient } from '@/lib/supabase/admin'
import { computeCustomReport, fetchReportDefinition, evaluateFormula, type ReportDefinition } from '@/lib/reports/custom-report'
import { computeProfitAndLoss } from '@/lib/reports/profit-loss'
import { REPORT_TEMPLATES } from '@/lib/reports/custom-report-templates'

const admin = createAdminClient()

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

const money = (n: number) => n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const near = (a: number, b: number) => Math.abs(a - b) < 0.01

/** Turns a template into an in-memory definition, no database involved. */
function definitionFromTemplate(key: string): ReportDefinition {
  const template = REPORT_TEMPLATES.find((t) => t.key === key)
  if (!template) throw new Error(`No template "${key}"`)
  return {
    id: `template-${key}`,
    name: template.name,
    description: template.description,
    basis: template.basis,
    hideZeroRows: false,   // keep every line so the comparison sees them all
    lines: template.lines.map((l, i) => ({
      id: `t${i}`,
      sortOrder: i,
      lineType: l.lineType,
      label: l.label,
      ref: l.ref ?? null,
      indent: l.indent ?? 0,
      sign: l.sign ?? 'natural',
      includeChildren: l.includeChildren ?? true,
      showDetail: l.showDetail ?? false,
      isBold: l.isBold ?? false,
      underline: l.underline ?? false,
      formula: l.formula ?? null,
      accountCodes: l.accountCodes ?? [],
    })),
  }
}

async function main() {
  // ---- formula evaluator ---------------------------------------------------
  const refs = new Map([['REV', 100], ['COGS', 40], ['OPEX', 10]])
  const f1 = evaluateFormula('REV - COGS', refs)
  check('formula: REV - COGS = 60', 'value' in f1 && f1.value === 60)
  const f2 = evaluateFormula('REV - COGS - OPEX', refs)
  check('formula: chained subtraction = 50', 'value' in f2 && f2.value === 50)
  const f3 = evaluateFormula('rev + 5', refs)
  check('formula: refs are case-insensitive, literals allowed', 'value' in f3 && f3.value === 105)
  const f4 = evaluateFormula('REV - NOPE', refs)
  check('formula: unknown ref is an error, not a zero', 'error' in f4, 'error' in f4 ? f4.error : '')
  const f5 = evaluateFormula('REV -', refs)
  check('formula: trailing operator rejected', 'error' in f5)
  const f6 = evaluateFormula('REV COGS', refs)
  check('formula: missing operator rejected', 'error' in f6)

  // ---- pick the tenant with the most ledger activity -----------------------
  const { data: lines } = await admin
    .from('tajir_journal_entry_lines')
    .select('tenant_id')
    .limit(5000)

  const counts = new Map<string, number>()
  for (const l of lines ?? []) counts.set(l.tenant_id, (counts.get(l.tenant_id) ?? 0) + 1)
  const tenantId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

  if (!tenantId) {
    console.log('\nNo journal lines in the database — skipping the data checks.')
    process.exit(failures > 0 ? 1 : 0)
  }
  console.log(`\nTenant under test: ${tenantId} (${counts.get(tenantId)} journal lines)\n`)

  const to = new Date().toISOString().split('T')[0]
  const from = '2000-01-01'

  // ---- custom P&L must equal the built-in P&L ------------------------------
  const builtIn = await computeProfitAndLoss({ admin, tenantId, from, to })
  const custom = await computeCustomReport({
    admin, tenantId, from, to,
    definition: definitionFromTemplate('profit_loss'),
  })

  const amountOf = (label: string) => custom.rows.find((r) => r.label === label)?.amount ?? null

  check('custom P&L: revenue matches built-in', near(amountOf('Sales Revenue') ?? NaN, builtIn.totalRevenue),
    `custom ${money(amountOf('Sales Revenue') ?? 0)} vs built-in ${money(builtIn.totalRevenue)}`)
  check('custom P&L: cost of sales matches built-in', near(amountOf('Cost of Sales') ?? NaN, builtIn.totalCostOfSales),
    `custom ${money(amountOf('Cost of Sales') ?? 0)} vs built-in ${money(builtIn.totalCostOfSales)}`)
  check('custom P&L: gross profit matches built-in', near(amountOf('Gross Profit') ?? NaN, builtIn.grossProfit),
    `custom ${money(amountOf('Gross Profit') ?? 0)} vs built-in ${money(builtIn.grossProfit)}`)
  check('custom P&L: operating expenses match built-in', near(amountOf('Operating Expenses') ?? NaN, builtIn.totalOperatingExpenses),
    `custom ${money(amountOf('Operating Expenses') ?? 0)} vs built-in ${money(builtIn.totalOperatingExpenses)}`)
  check('custom P&L: net profit matches built-in', near(amountOf('Net Profit') ?? NaN, builtIn.netProfit),
    `custom ${money(amountOf('Net Profit') ?? 0)} vs built-in ${money(builtIn.netProfit)}`)

  // ---- custom balance sheet must balance -----------------------------------
  const bs = await computeCustomReport({
    admin, tenantId, from, to,
    definition: definitionFromTemplate('balance_sheet'),
  })
  const bsAmount = (label: string) => bs.rows.find((r) => r.label === label)?.amount ?? null
  const totalAssets = bsAmount('Total Assets') ?? NaN
  const totalLiabEquity = bsAmount('Total Liabilities & Equity') ?? NaN
  check('custom balance sheet: assets = liabilities + equity', near(totalAssets, totalLiabEquity),
    `${money(totalAssets)} vs ${money(totalLiabEquity)}`)

  // ---- database round trip -------------------------------------------------
  const name = `__check__ ${Date.now()}`
  const { data: saved, error: saveErr } = await admin
    .from('custom_reports')
    .insert({ tenant_id: tenantId, name, basis: 'period', hide_zero_rows: false })
    .select('id')
    .single()

  if (saveErr || !saved) {
    check('round trip: report row saved', false, saveErr?.message ?? 'no row returned')
  } else {
    const { data: savedLines, error: lineErr } = await admin
      .from('custom_report_lines')
      .insert([
        // Every column is set on every row on purpose: supabase-js unions the
        // keys across a multi-row insert and sends the missing ones as NULL,
        // so a column relying on its DEFAULT would fail its NOT NULL check.
        { report_id: saved.id, tenant_id: tenantId, sort_order: 0, line_type: 'accounts', label: 'Revenue',    ref: 'REV', sign: 'credit_positive', include_children: true,  show_detail: true,  formula: null },
        { report_id: saved.id, tenant_id: tenantId, sort_order: 1, line_type: 'subtotal', label: 'Same again', ref: 'X',   sign: 'natural',         include_children: false, show_detail: false, formula: 'REV' },
      ])
      .select('id, sort_order')

    check('round trip: lines saved', !lineErr && (savedLines ?? []).length === 2, lineErr?.message ?? '')

    const revLineId = (savedLines ?? []).find((l) => l.sort_order === 0)?.id
    if (revLineId) {
      await admin.from('custom_report_line_accounts')
        .insert({ line_id: revLineId, tenant_id: tenantId, account_code: '4000' })
    }

    const loaded = await fetchReportDefinition({ admin, tenantId, reportId: saved.id })
    check('round trip: definition loads back', !!loaded && loaded.lines.length === 2, `got ${loaded?.lines.length ?? 'null'} line(s)`)
    check('round trip: account mapping survives', loaded?.lines[0]?.accountCodes.includes('4000') === true)

    if (loaded) {
      const run = await computeCustomReport({ admin, tenantId, definition: loaded, from, to })
      const revenue = run.rows.find((r) => r.label === 'Revenue')?.amount ?? NaN
      const echo = run.rows.find((r) => r.label === 'Same again')?.amount ?? NaN
      check('round trip: saved revenue line matches built-in P&L', near(revenue, builtIn.totalRevenue),
        `${money(revenue)} vs ${money(builtIn.totalRevenue)}`)
      check('round trip: subtotal resolves the saved ref', near(echo, revenue))
      check('round trip: detail rows render under the header',
        run.rows.some((r) => r.kind === 'detail') || revenue === 0)
    }

    // Cascades to lines and account mappings.
    await admin.from('custom_reports').delete().eq('id', saved.id)
    const gone = await fetchReportDefinition({ admin, tenantId, reportId: saved.id })
    check('round trip: delete removes the definition', gone === null)
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
