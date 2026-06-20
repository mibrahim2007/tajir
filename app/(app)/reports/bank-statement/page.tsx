import { Suspense } from 'react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { PrintButton } from '@/components/print-button'
import { BankStatementFilters } from './bank-statement-filters'
import { Landmark } from 'lucide-react'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function parseDate(val: unknown, fallback: string): string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val : fallback
}

type TxnRow = {
  key: string
  date: string
  type: 'Receipt' | 'Payment' | 'Expense' | 'Voucher'
  party: string
  description: string
  reference: string
  chequeNumber: string
  deposit: number
  withdrawal: number
  voucherNumber: string
}

export default async function BankStatementPage({ searchParams }: { searchParams: SearchParams }) {
  const { tenantId } = await requireAuth()
  const params = await searchParams

  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 8) + '01'
  const from   = parseDate(params.from, firstOfMonth)
  const to     = parseDate(params.to, today)
  const bankId = typeof params.bankId === 'string' ? params.bankId : ''

  const admin = createAdminClient()

  const { data: rawBanks } = await admin
    .from('banks')
    .select('id, name, account_number, branch')
    .eq('tenant_id', tenantId)
    .order('name')

  const banks = rawBanks ?? []
  const selectedBank = banks.find((b) => b.id === bankId)

  let rows: TxnRow[] = []

  if (bankId && selectedBank) {
    const [receiptsRes, paymentsRes, journalRes] = await Promise.all([
      // Customer receipts tagged to this bank
      admin.from('ar_receipts')
        .select('id, date, pkr_equivalent, payment_method_note, cheque_number, tajir_customers(name)')
        .eq('bank_id', bankId)
        .eq('tenant_id', tenantId)
        .gte('date', from)
        .lte('date', to)
        .order('date'),

      // Supplier payments tagged to this bank
      admin.from('ap_payments')
        .select('id, date, pkr_equivalent, payment_method_note, cheque_number, suppliers(name)')
        .eq('bank_id', bankId)
        .eq('tenant_id', tenantId)
        .gte('date', from)
        .lte('date', to)
        .order('date'),

      // Expenses and manual vouchers tagged to this bank
      admin.from('tajir_journal_entries')
        .select('id, date, description, reference, voucher_number, source_type, tajir_journal_entry_lines(debit, credit)')
        .eq('bank_id', bankId)
        .eq('tenant_id', tenantId)
        .gte('date', from)
        .lte('date', to)
        .order('date'),
    ])

    type RawReceipt = {
      id: string; date: string; pkr_equivalent: string; payment_method_note: string | null
      cheque_number: string | null; tajir_customers: { name: string } | null
    }
    type RawPayment = {
      id: string; date: string; pkr_equivalent: string; payment_method_note: string | null
      cheque_number: string | null; suppliers: { name: string } | null
    }
    type RawJournalLine = { debit: string; credit: string }
    type RawJournal = {
      id: string; date: string; description: string | null; reference: string | null
      voucher_number: string; source_type: string
      tajir_journal_entry_lines: RawJournalLine[]
    }

    const receiptRows: TxnRow[] = ((receiptsRes.data ?? []) as unknown as RawReceipt[]).map((r) => ({
      key: `rc-${r.id}`,
      date: r.date,
      type: 'Receipt',
      party: (r.tajir_customers as { name: string } | null)?.name ?? '—',
      description: r.payment_method_note ?? '',
      reference: '',
      chequeNumber: r.cheque_number ?? '',
      deposit: parseFloat(r.pkr_equivalent),
      withdrawal: 0,
      voucherNumber: '',
    }))

    const paymentRows: TxnRow[] = ((paymentsRes.data ?? []) as unknown as RawPayment[]).map((p) => ({
      key: `pm-${p.id}`,
      date: p.date,
      type: 'Payment',
      party: (p.suppliers as { name: string } | null)?.name ?? '—',
      description: p.payment_method_note ?? '',
      reference: '',
      chequeNumber: p.cheque_number ?? '',
      deposit: 0,
      withdrawal: parseFloat(p.pkr_equivalent),
      voucherNumber: '',
    }))

    const journalRows: TxnRow[] = ((journalRes.data ?? []) as unknown as RawJournal[]).map((je) => {
      const lines = je.tajir_journal_entry_lines ?? []
      const totalDebit  = lines.reduce((s, l) => s + parseFloat(l.debit), 0)
      const totalCredit = lines.reduce((s, l) => s + parseFloat(l.credit), 0)

      if (je.source_type === 'expense') {
        return {
          key: `ex-${je.id}`,
          date: je.date,
          type: 'Expense' as const,
          party: '',
          description: je.description ?? '',
          reference: je.reference ?? '',
          chequeNumber: '',
          deposit: 0,
          withdrawal: totalCredit || totalDebit,
          voucherNumber: je.voucher_number,
        }
      }
      const net = totalDebit - totalCredit
      return {
        key: `jv-${je.id}`,
        date: je.date,
        type: 'Voucher' as const,
        party: '',
        description: je.description ?? '',
        reference: je.reference ?? '',
        chequeNumber: '',
        deposit: net > 0 ? net : 0,
        withdrawal: net < 0 ? Math.abs(net) : 0,
        voucherNumber: je.voucher_number,
      }
    })

    rows = [...receiptRows, ...paymentRows, ...journalRows]
      .sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key))
  }

  const totalDeposits    = rows.reduce((s, r) => s + r.deposit, 0)
  const totalWithdrawals = rows.reduce((s, r) => s + r.withdrawal, 0)
  const netBalance       = totalDeposits - totalWithdrawals

  // Compute running balance
  let running = 0
  const rowsWithBalance = rows.map((r) => {
    running += r.deposit - r.withdrawal
    return { ...r, balance: running }
  })

  const TYPE_BADGE: Record<string, string> = {
    Receipt:    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    Payment:    'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
    Expense:    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    Voucher:    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  }

  const dateLabel = `${formatPKTDate(from + 'T00:00:00')} – ${formatPKTDate(to + 'T00:00:00')}`

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 print:mb-2">
        <div>
          <h1 className="text-2xl font-semibold">Bank Statement</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedBank
              ? `${selectedBank.name}${selectedBank.account_number ? ` · ${selectedBank.account_number}` : ''}${selectedBank.branch ? ` · ${selectedBank.branch}` : ''} · ${dateLabel}`
              : 'Select a bank to view its statement'}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          {selectedBank && rows.length > 0 && <PrintButton />}
        </div>
      </div>

      {/* Filters */}
      <Suspense>
        <BankStatementFilters bankId={bankId} from={from} to={to} banks={banks} />
      </Suspense>

      {/* No banks defined */}
      {banks.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Landmark className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm font-medium">No banks defined yet</p>
          <p className="text-muted-foreground text-xs mt-1">
            Go to <a href="/banks" className="underline">Settings → Banks</a> to add your bank accounts.
          </p>
        </div>
      )}

      {/* No bank selected */}
      {banks.length > 0 && !bankId && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">Select a bank above to view its statement.</p>
        </div>
      )}

      {/* Summary cards */}
      {selectedBank && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl border bg-gradient-to-br from-emerald-500 to-green-600 p-4 text-white shadow-sm">
              <p className="text-xs text-white/85">Total Deposits</p>
              <p className="text-lg font-bold tabular-nums mt-1">{formatPKR(totalDeposits)}</p>
              <p className="text-xs text-white/70 mt-0.5">
                {rows.filter(r => r.deposit > 0).length} transaction{rows.filter(r => r.deposit > 0).length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="rounded-xl border bg-gradient-to-br from-rose-500 to-red-600 p-4 text-white shadow-sm">
              <p className="text-xs text-white/85">Total Withdrawals</p>
              <p className="text-lg font-bold tabular-nums mt-1">{formatPKR(totalWithdrawals)}</p>
              <p className="text-xs text-white/70 mt-0.5">
                {rows.filter(r => r.withdrawal > 0).length} transaction{rows.filter(r => r.withdrawal > 0).length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className={`rounded-xl border p-4 text-white shadow-sm bg-gradient-to-br ${netBalance >= 0 ? 'from-indigo-500 to-purple-600' : 'from-orange-500 to-amber-600'}`}>
              <p className="text-xs text-white/85">Net Balance</p>
              <p className="text-lg font-bold tabular-nums mt-1">{formatPKR(netBalance)}</p>
              <p className="text-xs text-white/70 mt-0.5">{dateLabel}</p>
            </div>
          </div>

          {/* Transaction table */}
          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground text-sm">
                No transactions for <strong>{selectedBank.name}</strong> in this date range.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-3 py-3 font-medium w-28">Date</th>
                      <th className="text-left px-3 py-3 font-medium w-24">Type</th>
                      <th className="text-left px-3 py-3 font-medium w-36">Party</th>
                      <th className="text-left px-3 py-3 font-medium">Description</th>
                      <th className="text-left px-3 py-3 font-medium w-28">Cheque No.</th>
                      <th className="text-left px-3 py-3 font-medium w-28">Ref / Voucher</th>
                      <th className="text-right px-3 py-3 font-medium w-32">Deposit (PKR)</th>
                      <th className="text-right px-3 py-3 font-medium w-32">Withdrawal (PKR)</th>
                      <th className="text-right px-3 py-3 font-medium w-32">Balance (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rowsWithBalance.map((row) => (
                      <tr key={row.key} className="hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {formatPKTDate(row.date + 'T00:00:00')}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs rounded px-1.5 py-0.5 whitespace-nowrap font-medium ${TYPE_BADGE[row.type] ?? 'bg-muted text-muted-foreground'}`}>
                            {row.type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs font-medium">{row.party || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-xs truncate">
                          {row.description || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">
                          {row.chequeNumber || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">
                          {row.voucherNumber || row.reference || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium text-emerald-600">
                          {row.deposit > 0 ? formatPKR(row.deposit) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium text-rose-600">
                          {row.withdrawal > 0 ? formatPKR(row.withdrawal) : '—'}
                        </td>
                        <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${row.balance < 0 ? 'text-rose-600' : 'text-foreground'}`}>
                          {formatPKR(row.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/30">
                    <tr className="font-semibold">
                      <td className="px-3 py-3 text-right" colSpan={6}>
                        Total ({rows.length} transaction{rows.length !== 1 ? 's' : ''})
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-emerald-600">{formatPKR(totalDeposits)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-rose-600">{formatPKR(totalWithdrawals)}</td>
                      <td className={`px-3 py-3 text-right tabular-nums ${netBalance < 0 ? 'text-rose-600' : 'text-indigo-600'}`}>
                        {formatPKR(netBalance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Print footer */}
      {selectedBank && (
        <div className="hidden print:block mt-8 pt-4 border-t text-xs text-muted-foreground text-center">
          Bank Statement · {selectedBank.name}
          {selectedBank.account_number ? ` · ${selectedBank.account_number}` : ''}
          {' · '}{dateLabel} · Generated {formatPKTDate(new Date().toISOString())}
        </div>
      )}
    </div>
  )
}
