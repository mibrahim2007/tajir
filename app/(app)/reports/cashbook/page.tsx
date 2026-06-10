import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { PrintButton } from '@/components/print-button'
import { CashbookFilters } from './cashbook-filters'
import { Suspense } from 'react'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function parseDate(val: unknown, fallback: string): string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val : fallback
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual', sale_order: 'Sale', purchase_order: 'Purchase',
  ar_receipt: 'Receipt', ap_payment: 'Payment',
  sale_return: 'Sale Return', purchase_return: 'Purch. Return',
  expense: 'Expense',
}

export default async function CashbookPage({ searchParams }: { searchParams: SearchParams }) {
  const { tenantId } = await requireAuth()
  const params = await searchParams

  const today = new Date().toISOString().split('T')[0]
  const date = parseDate(params.date, today)
  const accountId = typeof params.accountId === 'string' ? params.accountId : ''

  const admin = createAdminClient()

  // Cash & bank accounts are the non-header children of the "Cash & Bank" group (parent 1100).
  const { data: rawCashAccounts } = await admin
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('is_header', false)
    .eq('parent_code', '1100')
    .order('code')

  const cashAccounts = rawCashAccounts ?? []
  const cashAccountIds = cashAccounts.map((a) => a.id)
  // Which accounts this run covers — all cash/bank, or a single selected one.
  const targetIds = accountId ? cashAccountIds.filter((id) => id === accountId) : cashAccountIds
  const accountMap = new Map(cashAccounts.map((a) => [a.id, a]))

  type Row = {
    lineId: string
    createdAt: string
    voucherNumber: string
    sourceType: string
    accountId: string
    accountCode: string
    accountName: string
    narration: string
    inflow: number
    outflow: number
  }

  let opening = 0
  let rows: Row[] = []

  if (targetIds.length > 0) {
    // Opening balance: net cash movement on all dates strictly before the report date.
    const { data: priorLines } = await admin
      .from('tajir_journal_entry_lines')
      .select('debit, credit, tajir_journal_entries!inner(date)')
      .eq('tenant_id', tenantId)
      .in('account_id', targetIds)
      .lt('tajir_journal_entries.date', date)

    for (const l of priorLines ?? []) {
      opening += parseFloat(l.debit) - parseFloat(l.credit)
    }

    // Day's movements through the cash/bank accounts.
    const { data: dayLines } = await admin
      .from('tajir_journal_entry_lines')
      .select(
        'id, account_id, description, debit, credit, ' +
          'tajir_journal_entries!inner(date, voucher_number, description, source_type, created_at)'
      )
      .eq('tenant_id', tenantId)
      .in('account_id', targetIds)
      .eq('tajir_journal_entries.date', date)

    type RawDayLine = {
      id: string
      account_id: string
      description: string | null
      debit: string
      credit: string
      tajir_journal_entries: {
        date: string
        voucher_number: string
        description: string | null
        source_type: string
        created_at: string
      }
    }

    rows = ((dayLines ?? []) as unknown as RawDayLine[])
      .map((l): Row => {
        const entry = l.tajir_journal_entries
        const acc = accountMap.get(l.account_id)
        return {
          lineId: l.id,
          createdAt: entry.created_at,
          voucherNumber: entry.voucher_number,
          sourceType: entry.source_type,
          accountId: l.account_id,
          accountCode: acc?.code ?? '—',
          accountName: acc?.name ?? '—',
          narration: l.description || entry.description || '',
          inflow: parseFloat(l.debit),
          outflow: parseFloat(l.credit),
        }
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  const totalIn = rows.reduce((s, r) => s + r.inflow, 0)
  const totalOut = rows.reduce((s, r) => s + r.outflow, 0)
  const closing = opening + totalIn - totalOut

  const selectedAccount = cashAccounts.find((a) => a.id === accountId)
  const dateLabel = formatPKTDate(date + 'T00:00:00')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6 print:mb-2">
        <div>
          <h1 className="text-2xl font-semibold">Daily Cashbook</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedAccount ? `${selectedAccount.code} — ${selectedAccount.name} · ` : 'All Cash & Bank · '}
            {dateLabel}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton />
        </div>
      </div>

      <Suspense>
        <CashbookFilters date={date} accountId={accountId} accounts={cashAccounts} />
      </Suspense>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border bg-gradient-to-br from-slate-500 to-slate-600 p-4 text-white shadow-sm">
          <p className="text-xs text-white/80">Opening Balance</p>
          <p className="text-lg font-bold tabular-nums mt-1">{formatPKR(opening)}</p>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-emerald-500 to-green-600 p-4 text-white shadow-sm">
          <p className="text-xs text-white/85">Cash In (Receipts)</p>
          <p className="text-lg font-bold tabular-nums mt-1">{formatPKR(totalIn)}</p>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-rose-500 to-red-600 p-4 text-white shadow-sm">
          <p className="text-xs text-white/85">Cash Out (Payments)</p>
          <p className="text-lg font-bold tabular-nums mt-1">{formatPKR(totalOut)}</p>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-indigo-500 to-purple-600 p-4 text-white shadow-sm">
          <p className="text-xs text-white/85">Closing Balance</p>
          <p className="text-lg font-bold tabular-nums mt-1">{formatPKR(closing)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center mt-4">
          <p className="text-muted-foreground text-sm">
            No cash or bank movements on {dateLabel}
            {selectedAccount ? ' for the selected account' : ''}.
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            Opening &amp; closing balance: {formatPKR(opening)}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-3 py-3 font-medium w-32">Voucher #</th>
                  <th className="text-left px-3 py-3 font-medium w-24">Type</th>
                  {!accountId && <th className="text-left px-3 py-3 font-medium w-40">Account</th>}
                  <th className="text-left px-3 py-3 font-medium">Narration</th>
                  <th className="text-right px-3 py-3 font-medium w-32">Cash In (PKR)</th>
                  <th className="text-right px-3 py-3 font-medium w-32">Cash Out (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr className="bg-muted/20 font-medium">
                  <td className="px-3 py-2.5" colSpan={accountId ? 3 : 4}>
                    Opening Balance
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums" colSpan={2}>
                    {formatPKR(opening)}
                  </td>
                </tr>
                {rows.map((row) => (
                  <tr key={row.lineId} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-xs text-primary">{row.voucherNumber}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs bg-muted rounded px-1.5 py-0.5 whitespace-nowrap">
                        {SOURCE_LABELS[row.sourceType] ?? row.sourceType}
                      </span>
                    </td>
                    {!accountId && (
                      <td className="px-3 py-2.5 text-xs">
                        <span className="font-mono text-muted-foreground">{row.accountCode}</span> {row.accountName}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{row.narration || '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600">
                      {row.inflow > 0 ? formatPKR(row.inflow) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-rose-600">
                      {row.outflow > 0 ? formatPKR(row.outflow) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30">
                <tr className="font-semibold">
                  <td className="px-3 py-3 text-right" colSpan={accountId ? 3 : 4}>
                    Day Total ({rows.length} {rows.length === 1 ? 'entry' : 'entries'})
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatPKR(totalIn)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatPKR(totalOut)}</td>
                </tr>
                <tr className="font-bold border-t">
                  <td className="px-3 py-3 text-right" colSpan={accountId ? 3 : 4}>
                    Closing Balance
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums" colSpan={2}>
                    {formatPKR(closing)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="hidden print:block mt-8 pt-4 border-t text-xs text-muted-foreground text-center">
        Daily Cashbook · {dateLabel} · Generated {formatPKTDate(new Date().toISOString())}
      </div>
    </div>
  )
}
