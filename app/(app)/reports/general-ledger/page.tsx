import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { PrintButton } from '@/components/print-button'
import { GeneralLedgerFilters } from './general-ledger-filters'
import { Suspense } from 'react'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function parseDate(val: unknown, fallback: string): string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val : fallback
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual', sale_order: 'Sale', purchase_order: 'Purchase',
  ar_receipt: 'Receipt', ap_payment: 'Payment',
  sale_return: 'Sale Return', purchase_return: 'Purch. Return',
}

export default async function GeneralLedgerPage({ searchParams }: { searchParams: SearchParams }) {
  const { tenantId } = await requireAuth()
  const params = await searchParams

  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 7) + '-01'
  const from = parseDate(params.from, firstOfMonth)
  const to = parseDate(params.to, today)
  const accountId = typeof params.accountId === 'string' ? params.accountId : ''

  const admin = createAdminClient()

  const [{ data: rawAccounts }, { data: rawEntries }] = await Promise.all([
    admin.from('chart_of_accounts')
      .select('id, code, name, account_type, is_header')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('is_header', false)
      .order('code'),
    admin.from('tajir_journal_entries')
      .select('id, voucher_number, date, description, source_type')
      .eq('tenant_id', tenantId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  const accounts = rawAccounts ?? []
  const entries = rawEntries ?? []
  const entryIds = entries.map((e) => e.id)

  // Fetch lines for these entries (optionally filtered by account)
  let linesQuery = admin.from('tajir_journal_entry_lines')
    .select('id, journal_entry_id, account_id, description, debit, credit')
    .eq('tenant_id', tenantId)
  if (entryIds.length > 0) {
    linesQuery = linesQuery.in('journal_entry_id', entryIds)
  }
  if (accountId) {
    linesQuery = linesQuery.eq('account_id', accountId)
  }

  const { data: rawLines } = entryIds.length > 0 ? await linesQuery : { data: [] }
  const lines = rawLines ?? []

  const entryMap = new Map(entries.map((e) => [e.id, e]))
  const accountMap = new Map(accounts.map((a) => [a.id, a]))

  // Build ledger rows: attach entry info to each line
  type LedgerRow = {
    lineId: string
    entryId: string
    date: string
    voucherNumber: string
    sourceType: string
    narration: string
    accountId: string
    accountCode: string
    accountName: string
    lineDescription: string
    debit: number
    credit: number
  }

  const rows: LedgerRow[] = []
  for (const line of lines) {
    const entry = entryMap.get(line.journal_entry_id)
    if (!entry) continue
    const acc = accountMap.get(line.account_id)
    rows.push({
      lineId: line.id,
      entryId: entry.id,
      date: entry.date,
      voucherNumber: entry.voucher_number,
      sourceType: entry.source_type,
      narration: entry.description ?? '',
      accountId: line.account_id,
      accountCode: acc?.code ?? '—',
      accountName: acc?.name ?? '—',
      lineDescription: line.description ?? '',
      debit: parseFloat(line.debit),
      credit: parseFloat(line.credit),
    })
  }

  const selectedAccount = accounts.find((a) => a.id === accountId)

  // Compute running balance per account (if single account selected)
  let runningBalance = 0
  const withBalance = rows.map((row) => {
    const isDebitNormal = ['asset', 'expense'].includes(
      accountMap.get(row.accountId)?.account_type ?? 'asset'
    )
    runningBalance += isDebitNormal ? row.debit - row.credit : row.credit - row.debit
    return { ...row, balance: runningBalance }
  })

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
  const dateLabel = `${formatPKTDate(from + 'T00:00:00')} – ${formatPKTDate(to + 'T00:00:00')}`

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-4 print:mb-2">
        <div>
          <h1 className="text-2xl font-semibold">General Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedAccount ? `${selectedAccount.code} — ${selectedAccount.name} · ` : ''}{dateLabel}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton />
        </div>
      </div>

      <Suspense>
        <GeneralLedgerFilters from={from} to={to} accountId={accountId} accounts={accounts} />
      </Suspense>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center mt-4">
          <p className="text-muted-foreground text-sm">
            No GL entries in this date range{accountId ? ' for the selected account' : ''}.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-3 py-3 font-medium w-28">Date</th>
                  <th className="text-left px-3 py-3 font-medium w-32">Voucher #</th>
                  <th className="text-left px-3 py-3 font-medium w-24">Type</th>
                  {!accountId && <th className="text-left px-3 py-3 font-medium">Account</th>}
                  <th className="text-left px-3 py-3 font-medium">Narration</th>
                  <th className="text-right px-3 py-3 font-medium w-32">Debit (PKR)</th>
                  <th className="text-right px-3 py-3 font-medium w-32">Credit (PKR)</th>
                  {accountId && <th className="text-right px-3 py-3 font-medium w-36">Balance (PKR)</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {withBalance.map((row) => (
                  <tr key={row.lineId} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                      {formatPKTDate(row.date + 'T00:00:00')}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-primary">
                      {row.voucherNumber}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs bg-muted rounded px-1.5 py-0.5 whitespace-nowrap">
                        {SOURCE_LABELS[row.sourceType] ?? row.sourceType}
                      </span>
                    </td>
                    {!accountId && (
                      <td className="px-3 py-2.5 text-xs">
                        <span className="font-mono text-muted-foreground">{row.accountCode}</span>{' '}
                        {row.accountName}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">
                      {row.lineDescription || row.narration || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.debit > 0 ? formatPKR(row.debit) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.credit > 0 ? formatPKR(row.credit) : '—'}
                    </td>
                    {accountId && (
                      <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${row.balance < 0 ? 'text-destructive' : ''}`}>
                        {formatPKR(Math.abs(row.balance))}{row.balance < 0 ? ' Cr' : ' Dr'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30">
                <tr className="font-semibold">
                  <td className="px-3 py-3 text-right" colSpan={accountId ? 4 : 5}>
                    Total ({rows.length} entries)
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatPKR(totalDebit)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatPKR(totalCredit)}</td>
                  {accountId && (
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatPKR(Math.abs(runningBalance))}{runningBalance < 0 ? ' Cr' : ' Dr'}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="hidden print:block mt-8 pt-4 border-t text-xs text-muted-foreground text-center">
        General Ledger · {dateLabel} · Generated {formatPKTDate(new Date().toISOString())}
      </div>
    </div>
  )
}
