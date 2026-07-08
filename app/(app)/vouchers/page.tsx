import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deleteJournalEntryAction } from '@/app/actions/delete-journal-entry'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

const SOURCE_LABELS: Record<string, string> = {
  manual:           'Manual Voucher',
  sale_order:       'Sale Invoice',
  purchase_order:   'Purchase Invoice',
  ar_receipt:       'Customer Receipt',
  ap_payment:       'Supplier Payment',
  sale_return:      'Sale Return',
  purchase_return:  'Purchase Return',
  credit_note:      'Credit Note',
  debit_note:       'Debit Note',
}

export default async function VouchersPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const { data: rawEntries } = await admin
    .from('tajir_journal_entries')
    .select('id, voucher_number, date, description, reference, source_type, created_at')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(300)

  const entries = rawEntries ?? []

  // Fetch totals per entry (sum of debit lines)
  const { data: rawTotals } = await admin
    .from('tajir_journal_entry_lines')
    .select('journal_entry_id, debit')
    .eq('tenant_id', tenantId)
    .gt('debit', '0')

  const totalsMap = new Map<string, number>()
  for (const line of rawTotals ?? []) {
    totalsMap.set(line.journal_entry_id, (totalsMap.get(line.journal_entry_id) ?? 0) + line.debit)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Vouchers / Journal Entries</h1>
          <p className="text-sm text-muted-foreground mt-1">{entries.length} entries</p>
        </div>
        <RoleGate allowedRoles={['owner']}>
          <Link href="/vouchers/new">
            <Button className="min-h-[44px]">New Voucher</Button>
          </Link>
        </RoleGate>
      </div>

      {entries.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No journal entries yet.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Voucher #</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Description</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Amount (Dr)</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link href={`/vouchers/${e.id}`} className="hover:underline text-primary">
                        {e.voucher_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(e.date))}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-muted rounded px-2 py-0.5">
                        {SOURCE_LABELS[e.source_type] ?? e.source_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.description ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {totalsMap.has(e.id) ? formatPKR(totalsMap.get(e.id)!) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <RoleGate allowedRoles={['owner']}>
                        {e.source_type === 'manual' && (
                          <DeleteButton
                            description="Delete this journal entry permanently?"
                            onDelete={deleteJournalEntryAction.bind(null, { id: e.id })}
                          />
                        )}
                      </RoleGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
