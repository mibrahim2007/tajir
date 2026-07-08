import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PrintButton } from '@/components/print-button'
import { ExportButton } from '@/components/export-button'
import { buildConsolidatedLedger } from '@/lib/ledger/consolidated'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

type Props = { params: Promise<{ linkId: string }> }

export default async function ConsolidatedLedgerDetailPage({ params }: Props) {
  const { tenantId } = await requireAuth()
  const { linkId } = await params
  const admin = createAdminClient()

  const { data: link } = await admin
    .from('party_links')
    .select('id, customer_id, supplier_id')
    .eq('id', linkId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!link) notFound()

  const [{ data: customer }, { data: supplier }] = await Promise.all([
    admin.from('tajir_customers').select('name').eq('id', link.customer_id).eq('tenant_id', tenantId).maybeSingle(),
    admin.from('suppliers').select('name').eq('id', link.supplier_id).eq('tenant_id', tenantId).maybeSingle(),
  ])

  const { rows, customerBalance, supplierBalance, netBalance } = await buildConsolidatedLedger(
    tenantId,
    link.customer_id,
    link.supplier_id,
  )

  const netLabel = netBalance > 0 ? 'Party owes us (net)' : netBalance < 0 ? 'We owe party (net)' : 'Settled'
  const netColor = netBalance > 0 ? 'text-amber-600 dark:text-amber-400' : netBalance < 0 ? 'text-destructive' : 'text-muted-foreground'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link
        href="/reports/consolidated-ledger"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="h-4 w-4" /> All mappings
      </Link>

      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {customer?.name ?? 'Customer'} <span className="text-muted-foreground font-normal">↔</span> {supplier?.name ?? 'Supplier'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Consolidated Ledger</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <PrintButton />
          <ExportButton href={`/api/export/consolidated-ledger/${linkId}`} label="Export CSV" />
        </div>
      </div>

      {/* Net + component balances */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-muted/30 px-4 py-3 sm:col-span-1">
          <p className="text-sm text-muted-foreground">Net Balance</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{netLabel}</p>
          <p className={`text-xl font-semibold tabular-nums mt-1 ${netColor}`}>{formatPKR(Math.abs(netBalance))}</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">As Customer (Receivable)</p>
          <p className="text-lg font-semibold tabular-nums mt-1">{formatPKR(Math.abs(customerBalance))}</p>
          <p className="text-[11px] text-muted-foreground/70">{customerBalance >= 0 ? 'they owe us' : 'in credit'}</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">As Supplier (Payable)</p>
          <p className="text-lg font-semibold tabular-nums mt-1">{formatPKR(Math.abs(supplierBalance))}</p>
          <p className="text-[11px] text-muted-foreground/70">{supplierBalance >= 0 ? 'we owe them' : 'they owe us'}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No transactions yet.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Description</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Source</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Debit (PKR)</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Credit (PKR)</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Balance (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className={`hover:bg-secondary/50 transition-colors ${row.side === 'supplier' ? 'bg-sky-50/40 dark:bg-sky-950/10' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(row.date))}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.description}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        row.side === 'customer'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300'
                      }`}>
                        {row.side === 'customer' ? 'Customer' : 'Supplier'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.debit > 0 ? formatPKR(row.debit) : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.credit > 0 ? formatPKR(row.credit) : '—'}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${row.balance > 0 ? 'text-amber-600 dark:text-amber-400' : row.balance < 0 ? 'text-destructive' : ''}`}>
                      {formatPKR(Math.abs(row.balance))}
                      {row.balance < 0 && <span className="ml-1 text-xs opacity-60">CR</span>}
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
