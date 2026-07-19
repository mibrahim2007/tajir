import type { SupabaseClient } from '@supabase/supabase-js'

// Shared Profit & Loss computation.
//
// Extracted from the P&L report page so that profit ALLOCATION and the report
// the owner is looking at can never disagree — allocating a different net
// profit than the report displays would silently misstate every partner's
// capital. Any change to the classification rules below must therefore be made
// here, once.
//
// Classification is hybrid, preserved exactly as the report has always done it:
//   revenue accounts        → credit-normal, amount = credit − debit
//   expense accounts, by first digit of `code`:
//     5xxx → Cost of Sales, 6xxx → Operating Expenses, 7xxx → Financial Charges
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
  totalRevenue: number
  totalCostOfSales: number
  grossProfit: number
  totalOperatingExpenses: number
  operatingProfit: number
  totalFinancialCharges: number
  netProfit: number
  hasData: boolean
  /**
   * Expense accounts excluded from net profit because their code does not begin
   * with 5, 6, or 7 (e.g. a user-created 8xxx account). They are silently
   * dropped by the classification above; surfaced here so callers that MOVE
   * money on the strength of this figure can warn instead of quietly
   * misallocating.
   */
  unclassified: PLRow[]
}

export async function computeProfitAndLoss(params: {
  admin: SupabaseClient
  tenantId: string
  from: string
  to: string
}): Promise<ProfitLoss> {
  const { admin, tenantId, from, to } = params

  const [{ data: rawAccounts }, { data: rawEntries }] = await Promise.all([
    admin.from('chart_of_accounts')
      .select('id, code, name, account_type')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('is_header', false)
      .order('code'),
    admin.from('tajir_journal_entries')
      .select('id')
      .eq('tenant_id', tenantId)
      .gte('date', from)
      .lte('date', to),
  ])

  const accounts = rawAccounts ?? []
  const entryIds = (rawEntries ?? []).map((e: { id: string }) => e.id)

  const { data: rawLines } = entryIds.length > 0
    ? await admin.from('tajir_journal_entry_lines')
        .select('account_id, debit, credit')
        .eq('tenant_id', tenantId)
        .in('journal_entry_id', entryIds)
    : { data: [] }

  const lines = (rawLines ?? []) as { account_id: string; debit: number; credit: number }[]

  // Aggregate net per account (raw = debit − credit)
  const netByAccount = new Map<string, number>()
  for (const line of lines) {
    const prev = netByAccount.get(line.account_id) ?? 0
    netByAccount.set(line.account_id, prev + line.debit - line.credit)
  }

  const plAccounts = accounts.filter(
    (a: { account_type: string }) => a.account_type === 'revenue' || a.account_type === 'expense',
  ) as { id: string; code: string; name: string; account_type: string }[]

  const revenue: PLRow[] = []
  const costOfSales: PLRow[] = []
  const operatingExpenses: PLRow[] = []
  const financialCharges: PLRow[] = []
  const unclassified: PLRow[] = []

  for (const acc of plAccounts) {
    const raw = netByAccount.get(acc.id) ?? 0
    const codePrefix = parseInt(acc.code.slice(0, 1), 10)

    if (acc.account_type === 'revenue') {
      revenue.push({ code: acc.code, name: acc.name, amount: -raw })
    } else if (codePrefix === 5) {
      costOfSales.push({ code: acc.code, name: acc.name, amount: raw })
    } else if (codePrefix === 6) {
      operatingExpenses.push({ code: acc.code, name: acc.name, amount: raw })
    } else if (codePrefix === 7) {
      financialCharges.push({ code: acc.code, name: acc.name, amount: raw })
    } else if (raw !== 0) {
      unclassified.push({ code: acc.code, name: acc.name, amount: raw })
    }
  }

  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0)
  const totalCostOfSales = costOfSales.reduce((s, r) => s + r.amount, 0)
  const grossProfit = totalRevenue - totalCostOfSales
  const totalOperatingExpenses = operatingExpenses.reduce((s, r) => s + r.amount, 0)
  const operatingProfit = grossProfit - totalOperatingExpenses
  const totalFinancialCharges = financialCharges.reduce((s, r) => s + r.amount, 0)
  const netProfit = operatingProfit - totalFinancialCharges

  return {
    revenue,
    costOfSales,
    operatingExpenses,
    financialCharges,
    totalRevenue,
    totalCostOfSales,
    grossProfit,
    totalOperatingExpenses,
    operatingProfit,
    totalFinancialCharges,
    netProfit,
    hasData: plAccounts.some((a) => netByAccount.has(a.id)),
    unclassified,
  }
}
