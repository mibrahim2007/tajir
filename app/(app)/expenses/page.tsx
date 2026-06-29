import Link from 'next/link'
import { Plus } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { RoleGate } from '@/components/role-gate'
import { DeleteExpenseButton } from './delete-expense-button'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

export default async function ExpensesPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const { data: rawEntries } = await admin
    .from('tajir_journal_entries')
    .select('id, voucher_number, date, description')
    .eq('tenant_id', tenantId)
    .eq('source_type', 'expense')
    .order('date', { ascending: false })

  const entries = rawEntries ?? []
  const entryIds = entries.map((e) => e.id)

  // Fetch debit lines (expense account) for each entry
  const { data: rawLines } = entryIds.length > 0
    ? await admin
        .from('tajir_journal_entry_lines')
        .select('journal_entry_id, account_id, debit')
        .eq('tenant_id', tenantId)
        .in('journal_entry_id', entryIds)
        .gt('debit', '0')
    : { data: [] }

  const lines = rawLines ?? []

  // Fetch account names for the debit lines
  const accountIds = [...new Set(lines.map((l) => l.account_id))]
  const { data: rawAccounts } = accountIds.length > 0
    ? await admin
        .from('chart_of_accounts')
        .select('id, code, name')
        .in('id', accountIds)
    : { data: [] }

  const accountMap = new Map((rawAccounts ?? []).map((a) => [a.id, a]))
  const lineByEntry = new Map(lines.map((l) => [l.journal_entry_id, l]))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">{entries.length} expense{entries.length !== 1 ? 's' : ''}</p>
        </div>
        <RoleGate allowedRoles={['owner']}>
          <Button asChild className="min-h-[44px]">
            <Link href="/expenses/new"><Plus className="h-4 w-4 mr-2" />New Expense</Link>
          </Button>
        </RoleGate>
      </div>

      {entries.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No expenses recorded yet.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-28">Date</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-28">Voucher #</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Account</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Description</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-36">Amount (PKR)</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((e) => {
                const line = lineByEntry.get(e.id)
                const acc = line ? accountMap.get(line.account_id) : null
                return (
                  <tr key={e.id} className="hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      {formatPKTDate(e.date + 'T00:00:00')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-primary">
                      {e.voucher_number}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {acc ? (
                        <>
                          <span className="font-mono text-muted-foreground mr-1">{acc.code}</span>
                          {acc.name}
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{e.description || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {line ? formatPKR(parseFloat(line.debit)) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RoleGate allowedRoles={['owner']}>
                        <DeleteExpenseButton id={e.id} />
                      </RoleGate>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
