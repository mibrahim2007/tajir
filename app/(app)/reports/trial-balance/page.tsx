import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchLedgerTotals } from '@/lib/reports/ledger-totals'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { PrintButton } from '@/components/print-button'
import { TrialBalanceFilters } from './trial-balance-filters'
import { Suspense } from 'react'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function parseDate(val: unknown, fallback: string): string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val : fallback
}

const TYPE_ORDER = ['asset', 'liability', 'equity', 'revenue', 'expense']
const TYPE_LABELS: Record<string, string> = {
  asset: 'Assets', liability: 'Liabilities', equity: 'Equity',
  revenue: 'Revenue', expense: 'Expenses',
}

export default async function TrialBalancePage({ searchParams }: { searchParams: SearchParams }) {
  const { tenantId } = await requireAuth()
  const params = await searchParams
  const today = new Date().toISOString().split('T')[0]
  const asOf = parseDate(params.asOf, today)

  const admin = createAdminClient()

  const [{ data: rawAccounts }, ledger] = await Promise.all([
    admin.from('chart_of_accounts')
      .select('id, code, name, account_type, is_header')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('is_header', false)
      .order('code'),
    // No `from` — a trial balance is cumulative to the as-of date.
    fetchLedgerTotals({ admin, tenantId, to: asOf }),
  ])

  const accounts = rawAccounts ?? []
  const totals = ledger.byAccount

  // Only accounts with activity
  const activeAccounts = accounts.filter((a) => totals.has(a.id))

  // Group by account_type
  type AccountRow = {
    id: string; code: string; name: string; accountType: string
    totalDebit: number; totalCredit: number; netBalance: number
  }

  const byType = new Map<string, AccountRow[]>()
  for (const acc of activeAccounts) {
    const t = totals.get(acc.id) ?? { debit: 0, credit: 0 }
    // Net balance: normal balance direction per type
    const netBalance = ['asset', 'expense'].includes(acc.account_type)
      ? t.debit - t.credit
      : t.credit - t.debit
    const row: AccountRow = {
      id: acc.id, code: acc.code, name: acc.name, accountType: acc.account_type,
      totalDebit: t.debit, totalCredit: t.credit, netBalance,
    }
    const group = byType.get(acc.account_type) ?? []
    group.push(row)
    byType.set(acc.account_type, group)
  }

  const grandDebit  = activeAccounts.reduce((s, a) => s + (totals.get(a.id)?.debit  ?? 0), 0)
  const grandCredit = activeAccounts.reduce((s, a) => s + (totals.get(a.id)?.credit ?? 0), 0)
  const isBalanced  = Math.abs(grandDebit - grandCredit) < 0.01

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6 print:mb-2">
        <div>
          <h1 className="text-2xl font-semibold">Trial Balance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            As of {formatPKTDate(asOf + 'T00:00:00')}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton />
        </div>
      </div>

      <Suspense>
        <TrialBalanceFilters asOf={asOf} />
      </Suspense>

      {activeAccounts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center mt-4">
          <p className="text-muted-foreground text-sm">
            No GL entries found. Transactions will auto-post once the chart of accounts is seeded.
          </p>
        </div>
      ) : (
        <div className="space-y-4 mt-4">
          {TYPE_ORDER.filter((t) => byType.has(t)).map((type) => {
            const rows = byType.get(type)!
            const sectionDebit  = rows.reduce((s, r) => s + r.totalDebit, 0)
            const sectionCredit = rows.reduce((s, r) => s + r.totalCredit, 0)
            return (
              <div key={type} className="rounded-lg border overflow-hidden">
                <div className="bg-muted/50 border-b px-4 py-2">
                  <span className="font-semibold text-sm">{TYPE_LABELS[type]}</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-muted-foreground text-xs">
                      <th className="text-left px-4 py-2 font-medium w-20">Code</th>
                      <th className="text-left px-4 py-2 font-medium">Account</th>
                      <th className="text-right px-4 py-2 font-medium w-36">Debit (PKR)</th>
                      <th className="text-right px-4 py-2 font-medium w-36">Credit (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{row.code}</td>
                        <td className="px-4 py-2.5">{row.name}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {row.totalDebit > 0 ? formatPKR(row.totalDebit) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {row.totalCredit > 0 ? formatPKR(row.totalCredit) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/20">
                    <tr className="text-xs font-medium">
                      <td className="px-4 py-2" colSpan={2}>
                        Subtotal — {TYPE_LABELS[type]}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatPKR(sectionDebit)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatPKR(sectionCredit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          })}

          {/* Grand Total */}
          <div className={`rounded-lg border overflow-hidden ${isBalanced ? 'border-green-200' : 'border-destructive'}`}>
            <table className="w-full text-sm">
              <tfoot>
                <tr className={`font-bold ${isBalanced ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                  <td className="px-4 py-3 text-right" colSpan={2}>Grand Total</td>
                  <td className="px-4 py-3 text-right tabular-nums w-36">{formatPKR(grandDebit)}</td>
                  <td className="px-4 py-3 text-right tabular-nums w-36">{formatPKR(grandCredit)}</td>
                </tr>
                {!isBalanced && (
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-destructive text-xs text-center">
                      Difference of {formatPKR(Math.abs(grandDebit - grandCredit))} — books do not balance.
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="hidden print:block mt-8 pt-4 border-t text-xs text-muted-foreground text-center">
        Trial Balance as of {formatPKTDate(asOf + 'T00:00:00')} · Generated {formatPKTDate(new Date().toISOString())}
      </div>
    </div>
  )
}
