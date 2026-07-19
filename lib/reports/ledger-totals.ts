import type { SupabaseClient } from '@supabase/supabase-js'

// Shared GL aggregation for the financial reports (P&L, Balance Sheet, Trial
// Balance). Each of those used to fetch and total journal lines itself, which
// is how their numbers were able to drift apart.
//
// The date filter is applied server-side via an inner join on the entry, rather
// than fetching every entry id and passing them back as an `.in(...)` list. The
// old approach put one uuid per entry into the request URL, so a tenant with a
// few thousand entries would silently exceed the URL limit and report WRONG
// TOTALS with no error — a bad failure mode for financial statements.

export type AccountTotals = { debit: number; credit: number; net: number }

export type LedgerTotals = {
  /** accountId → totals. Only accounts with at least one line appear. */
  byAccount: Map<string, AccountTotals>
  hasAny: boolean
}

export async function fetchLedgerTotals(params: {
  admin: SupabaseClient
  tenantId: string
  /** Inclusive lower bound. Omit for cumulative-to-date (balance sheet, trial balance). */
  from?: string
  /** Inclusive upper bound. */
  to: string
}): Promise<LedgerTotals> {
  const { admin, tenantId, from, to } = params

  let query = admin
    .from('tajir_journal_entry_lines')
    .select('account_id, debit, credit, tajir_journal_entries!inner(date)')
    .eq('tenant_id', tenantId)
    .lte('tajir_journal_entries.date', to)

  if (from) query = query.gte('tajir_journal_entries.date', from)

  const { data, error } = await query

  // Surface rather than silently reporting zeroes as though the books were empty.
  if (error) {
    console.error(`[fetchLedgerTotals] ${error.message} (tenant=${tenantId} from=${from ?? '-'} to=${to})`)
    throw new Error(`Could not load ledger totals: ${error.message}`)
  }

  const rows = (data ?? []) as unknown as { account_id: string; debit: number; credit: number }[]

  const byAccount = new Map<string, AccountTotals>()
  for (const line of rows) {
    const prev = byAccount.get(line.account_id) ?? { debit: 0, credit: 0, net: 0 }
    const debit = prev.debit + line.debit
    const credit = prev.credit + line.credit
    byAccount.set(line.account_id, { debit, credit, net: debit - credit })
  }

  return { byAccount, hasAny: rows.length > 0 }
}
