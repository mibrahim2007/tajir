import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { Button } from '@/components/ui/button'

const SOURCE_LABELS: Record<string, string> = {
  manual:          'Manual Voucher',
  sale_order:      'Sale Invoice',
  purchase_order:  'Purchase Invoice',
  ar_receipt:      'Customer Receipt',
  ap_payment:      'Supplier Payment',
  sale_return:     'Sale Return',
  purchase_return: 'Purchase Return',
}

export default async function VoucherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: entry }, { data: rawLines }] = await Promise.all([
    admin.from('tajir_journal_entries')
      .select('id, voucher_number, date, description, reference, source_type')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single(),
    admin.from('tajir_journal_entry_lines')
      .select('id, account_id, description, debit, credit, customer_id, supplier_id, stock_item_id')
      .eq('journal_entry_id', id)
      .eq('tenant_id', tenantId)
      .order('created_at'),
  ])

  if (!entry) notFound()

  const lines = rawLines ?? []

  // Fetch account names
  const accountIds = [...new Set(lines.map((l) => l.account_id))]
  const { data: rawAccounts } = await admin
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('tenant_id', tenantId)
    .in('id', accountIds)

  const accountMap = new Map((rawAccounts ?? []).map((a) => [a.id, `${a.code} — ${a.name}`]))

  const totalDebit  = lines.reduce((s, l) => s + parseFloat(l.debit), 0)
  const totalCredit = lines.reduce((s, l) => s + parseFloat(l.credit), 0)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm text-muted-foreground">{SOURCE_LABELS[entry.source_type] ?? entry.source_type}</p>
          <h1 className="text-2xl font-semibold font-mono">{entry.voucher_number}</h1>
          <p className="text-sm text-muted-foreground mt-1">{formatPKTDate(new Date(entry.date))}</p>
        </div>
        <Link href="/vouchers">
          <Button variant="outline" className="min-h-[44px]">Back</Button>
        </Link>
      </div>

      {entry.description && (
        <p className="text-sm mb-2"><span className="font-medium">Narration:</span> {entry.description}</p>
      )}
      {entry.reference && (
        <p className="text-sm mb-4"><span className="font-medium">Reference:</span> {entry.reference}</p>
      )}

      <div className="rounded-lg border overflow-hidden mt-4">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Account</th>
              <th className="text-left px-4 py-3 font-medium">Description</th>
              <th className="text-right px-4 py-3 font-medium w-36">Debit (PKR)</th>
              <th className="text-right px-4 py-3 font-medium w-36">Credit (PKR)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((line) => (
              <tr key={line.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-mono text-xs">{accountMap.get(line.account_id) ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{line.description ?? ''}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {parseFloat(line.debit) > 0 ? formatPKR(parseFloat(line.debit)) : ''}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {parseFloat(line.credit) > 0 ? formatPKR(parseFloat(line.credit)) : ''}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/30">
            <tr>
              <td className="px-4 py-3 font-semibold" colSpan={2}>Total</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPKR(totalDebit)}</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPKR(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {Math.abs(totalDebit - totalCredit) > 0.01 && (
        <p className="mt-3 text-sm text-destructive">Warning: Debits and credits do not balance.</p>
      )}
    </div>
  )
}
