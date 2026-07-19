import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchLedgerTotals, type LedgerTotals } from './ledger-totals'

// Shared Profit & Loss computation.
//
// Used by the P&L report, the Balance Sheet's "net profit for the period" equity
// row, and profit ALLOCATION. Allocating or presenting a different net profit
// than the report displays would misstate every partner's capital, so the rule
// lives here once.
//
// Sectioning of expenses is by the first digit of `code`:
//   5xxx → Cost of Sales, 6xxx → Operating Expenses, 7xxx → Financial Charges,
//   anything else → Other Expenses.
//
// That last bucket matters: expenses outside 5/6/7 used to be dropped from net
// profit entirely, while the Balance Sheet counted every expense account. An
// account numbered e.g. 8100 therefore made the two reports disagree AND made
// the balance sheet fail to balance. Everything typed `expense` is now counted.
//
// Contra accounts need no special case: 4110 Sales Returns is posted DR and so
// lands as a NEGATIVE revenue row; 5110 Purchase Returns is posted CR and lands
// as a NEGATIVE cost row. Both correctly reduce their section total.

export type PLRow = { code: string; name: string; amount: number }

export type ProfitLoss = {
  revenue: PLRow[]
  costOfSales: PLRow[]
  operatingExpenses: PLRow[]
  financialCharges: PLRow[]
  /** Expense accounts whose code does not begin with 5, 6, or 7. Counted in net profit. */
  otherExpenses: PLRow[]
  totalRevenue: number
  totalCostOfSales: number
  grossProfit: number
  totalOperatingExpenses: number
  operatingProfit: number
  totalFinancialCharges: number
  totalOtherExpenses: number
  netProfit: number
  hasData: boolean
}

type PLAccount = { id: string; code: string; name: string; account_type: string }

/**
 * Classifies pre-fetched accounts + totals. Split out so a caller that already
 * has ledger totals (the Balance Sheet) doesn't query the ledger twice.
 */
export function classifyProfitAndLoss(accounts: PLAccount[], totals: LedgerTotals): ProfitLoss {
  const plAccounts = accounts.filter((a) => a.account_type === 'revenue' || a.account_type === 'expense')

  const revenue: PLRow[] = []
  const costOfSales: PLRow[] = []
  const operatingExpenses: PLRow[] = []
  const financialCharges: PLRow[] = []
  const otherExpenses: PLRow[] = []

  for (const acc of plAccounts) {
    const raw = totals.byAccount.get(acc.id)?.net ?? 0
    const codePrefix = parseInt(acc.code.slice(0, 1), 10)
    const row = { code: acc.code, name: acc.name, amount: acc.account_type === 'revenue' ? -raw : raw }

    if (acc.account_type === 'revenue') revenue.push(row)
    else if (codePrefix === 5) costOfSales.push(row)
    else if (codePrefix === 6) operatingExpenses.push(row)
    else if (codePrefix === 7) financialCharges.push(row)
    else otherExpenses.push(row)
  }

  const sum = (rows: PLRow[]) => rows.reduce((s, r) => s + r.amount, 0)

  const totalRevenue = sum(revenue)
  const totalCostOfSales = sum(costOfSales)
  const grossProfit = totalRevenue - totalCostOfSales
  const totalOperatingExpenses = sum(operatingExpenses)
  const operatingProfit = grossProfit - totalOperatingExpenses
  const totalFinancialCharges = sum(financialCharges)
  const totalOtherExpenses = sum(otherExpenses)
  const netProfit = operatingProfit - totalFinancialCharges - totalOtherExpenses

  return {
    revenue, costOfSales, operatingExpenses, financialCharges, otherExpenses,
    totalRevenue, totalCostOfSales, grossProfit,
    totalOperatingExpenses, operatingProfit,
    totalFinancialCharges, totalOtherExpenses, netProfit,
    hasData: plAccounts.some((a) => totals.byAccount.has(a.id)),
  }
}

/** Fetches accounts + ledger totals for the period, then classifies them. */
export async function computeProfitAndLoss(params: {
  admin: SupabaseClient
  tenantId: string
  /** Omit for cumulative-to-date. */
  from?: string
  to: string
}): Promise<ProfitLoss> {
  const { admin, tenantId, from, to } = params

  const [{ data: rawAccounts }, totals] = await Promise.all([
    admin.from('chart_of_accounts')
      .select('id, code, name, account_type')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('is_header', false)
      .order('code'),
    fetchLedgerTotals({ admin, tenantId, from, to }),
  ])

  return classifyProfitAndLoss((rawAccounts ?? []) as PLAccount[], totals)
}
