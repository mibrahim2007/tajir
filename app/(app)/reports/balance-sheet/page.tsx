import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { PrintButton } from '@/components/print-button'
import { BalanceSheetFilters } from './balance-sheet-filters'
import { Suspense } from 'react'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function parseDate(val: unknown, fallback: string): string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val : fallback
}

function SectionTable({ title, rows, netLabel, net }: {
  title: string
  rows: { code: string; name: string; amount: number }[]
  netLabel: string
  net: number
}) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="bg-muted/50 border-b px-4 py-2">
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.code} className="hover:bg-muted/20">
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground w-20">{row.code}</td>
              <td className="px-4 py-2.5">{row.name}</td>
              <td className="px-4 py-2.5 text-right tabular-nums w-40">
                {row.amount !== 0 ? formatPKR(row.amount) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t bg-muted/20">
          <tr className="font-semibold text-sm">
            <td className="px-4 py-2.5" colSpan={2}>{netLabel}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{formatPKR(net)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default async function BalanceSheetPage({ searchParams }: { searchParams: SearchParams }) {
  const { tenantId } = await requireAuth()
  const params = await searchParams

  const today = new Date().toISOString().split('T')[0]
  const asOf = parseDate(params.asOf, today)

  const admin = createAdminClient()

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
      .lte('date', asOf),
  ])

  const accounts = rawAccounts ?? []
  const entryIds = (rawEntries ?? []).map((e) => e.id)

  const { data: rawLines } = entryIds.length > 0
    ? await admin.from('tajir_journal_entry_lines')
        .select('account_id, debit, credit')
        .eq('tenant_id', tenantId)
        .in('journal_entry_id', entryIds)
    : { data: [] }

  const lines = rawLines ?? []

  // Aggregate net per account (debit - credit)
  const netByAccount = new Map<string, number>()
  for (const line of lines) {
    const prev = netByAccount.get(line.account_id) ?? 0
    netByAccount.set(line.account_id, prev + line.debit - line.credit)
  }

  type BSRow = { code: string; name: string; amount: number }

  const assetRows: BSRow[] = []
  const liabilityRows: BSRow[] = []
  const equityRows: BSRow[] = []

  // Net profit from P&L accounts (revenue - expenses) cumulative to asOf
  let netProfitFromPL = 0

  for (const acc of accounts) {
    const raw = netByAccount.get(acc.id) ?? 0
    if (raw === 0) continue

    if (acc.account_type === 'asset') {
      // Debit-normal: positive raw = asset balance
      assetRows.push({ code: acc.code, name: acc.name, amount: raw })
    } else if (acc.account_type === 'liability') {
      // Credit-normal: positive credit means liability
      liabilityRows.push({ code: acc.code, name: acc.name, amount: -raw })
    } else if (acc.account_type === 'equity') {
      equityRows.push({ code: acc.code, name: acc.name, amount: -raw })
    } else if (acc.account_type === 'revenue') {
      // Revenue has credit-normal balance; credit > debit means income
      netProfitFromPL += -raw
    } else if (acc.account_type === 'expense') {
      // Expense has debit-normal balance; debit > credit = cost
      netProfitFromPL -= raw
    }
  }

  const totalAssets = assetRows.reduce((s, r) => s + r.amount, 0)
  const totalLiabilities = liabilityRows.reduce((s, r) => s + r.amount, 0)
  const totalEquity = equityRows.reduce((s, r) => s + r.amount, 0) + netProfitFromPL
  const totalLiabEquity = totalLiabilities + totalEquity
  const isBalanced = Math.abs(totalAssets - totalLiabEquity) < 0.01

  const hasData = accounts.some((a) => netByAccount.has(a.id))

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-6 print:mb-2">
        <div>
          <h1 className="text-2xl font-semibold">Balance Sheet</h1>
          <p className="text-sm text-muted-foreground mt-1">
            As of {formatPKTDate(asOf + 'T00:00:00')}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton />
        </div>
      </div>

      <Suspense>
        <BalanceSheetFilters asOf={asOf} />
      </Suspense>

      {!hasData ? (
        <div className="rounded-lg border border-dashed p-12 text-center mt-4">
          <p className="text-muted-foreground text-sm">
            No GL entries found as of this date.
          </p>
        </div>
      ) : (
        <div className="space-y-3 mt-4">
          {/* ASSETS */}
          {assetRows.length > 0 && (
            <SectionTable
              title="Assets"
              rows={assetRows}
              netLabel="Total Assets"
              net={totalAssets}
            />
          )}

          {/* LIABILITIES */}
          {liabilityRows.length > 0 && (
            <SectionTable
              title="Liabilities"
              rows={liabilityRows}
              netLabel="Total Liabilities"
              net={totalLiabilities}
            />
          )}

          {/* EQUITY */}
          <div className="rounded-lg border overflow-hidden">
            <div className="bg-muted/50 border-b px-4 py-2">
              <span className="font-semibold text-sm">Equity</span>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {equityRows.map((row) => (
                  <tr key={row.code} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground w-20">{row.code}</td>
                    <td className="px-4 py-2.5">{row.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums w-40">{formatPKR(row.amount)}</td>
                  </tr>
                ))}
                <tr className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground w-20">—</td>
                  <td className="px-4 py-2.5 italic text-muted-foreground">
                    {netProfitFromPL >= 0 ? 'Net Profit (current period)' : 'Net Loss (current period)'}
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular-nums w-40 ${netProfitFromPL < 0 ? 'text-destructive' : ''}`}>
                    {formatPKR(netProfitFromPL)}
                  </td>
                </tr>
              </tbody>
              <tfoot className="border-t bg-muted/20">
                <tr className="font-semibold text-sm">
                  <td className="px-4 py-2.5" colSpan={2}>Total Equity</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatPKR(totalEquity)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Balance check */}
          <div className={`rounded-lg border overflow-hidden ${isBalanced ? 'border-green-200' : 'border-destructive'}`}>
            <table className="w-full text-sm">
              <tbody>
                <tr className={`font-bold ${isBalanced ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                  <td className="px-4 py-3">Total Liabilities + Equity</td>
                  <td className="px-4 py-3 text-right tabular-nums w-40">{formatPKR(totalLiabEquity)}</td>
                </tr>
                {!isBalanced && (
                  <tr>
                    <td colSpan={2} className="px-4 py-2 text-destructive text-xs text-center">
                      Difference of {formatPKR(Math.abs(totalAssets - totalLiabEquity))} — sheet does not balance.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="hidden print:block mt-8 pt-4 border-t text-xs text-muted-foreground text-center">
        Balance Sheet as of {formatPKTDate(asOf + 'T00:00:00')} · Generated {formatPKTDate(new Date().toISOString())}
      </div>
    </div>
  )
}
