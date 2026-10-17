import { Suspense } from 'react'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { PrintButton } from '@/components/print-button'
import { ExportButton } from '@/components/export-button'
import { buildPendingReceivables, parsePendingFilters, type PendingRow } from '@/lib/reports/pending-receivables'
import { PendingReceivablesFilters } from './pending-receivables-filters'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const fmtDate = (d: string) => formatPKTDate(d + 'T00:00:00')
const money = (n: number) => (Math.abs(n) > 0.005 ? formatPKR(n) : '—')

function DueCell({ row }: { row: PendingRow }) {
  if (row.isOpening) return <span className="text-muted-foreground">—</span>
  if (!row.dueDate) return <span className="text-muted-foreground">No due date</span>
  if (row.overdueDays !== null) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
        {row.overdueDays}d overdue
      </span>
    )
  }
  return <span className="text-xs text-muted-foreground">due {fmtDate(row.dueDate)}</span>
}

export default async function PendingReceivablesPage({ searchParams }: { searchParams: SearchParams }) {
  const { tenantId } = await requireAuth()
  const params  = await searchParams
  const filters = parsePendingFilters(params)

  const admin = createAdminClient()
  const [{ customers, totals }, { data: rawCustomers }] = await Promise.all([
    buildPendingReceivables(tenantId, filters),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId).order('name'),
  ])
  const customerList = rawCustomers ?? []
  const customerName = filters.customerId ? customerList.find((c) => c.id === filters.customerId)?.name : undefined

  const exportQuery = new URLSearchParams(
    Object.entries({ customer: filters.customerId, status: filters.status === 'all' ? undefined : filters.status, q: filters.q })
      .filter((e): e is [string, string] => !!e[1]),
  ).toString()

  const today = new Date().toISOString().split('T')[0]
  const subtitle = [
    `As of ${fmtDate(today)}`,
    customerName,
    filters.status === 'overdue' ? 'Overdue only' : filters.status === 'current' ? 'Not yet due' : null,
    filters.q ? `“${filters.q}”` : null,
  ].filter(Boolean).join(' · ')

  const bucketCards: { label: string; key: keyof typeof totals.buckets; tone: string }[] = [
    { label: '0–30 days',  key: '0-30',  tone: 'bg-emerald-500' },
    { label: '31–60 days', key: '31-60', tone: 'bg-amber-400' },
    { label: '61–90 days', key: '61-90', tone: 'bg-orange-500' },
    { label: '90+ days',   key: '90+',   tone: 'bg-red-500' },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 print:mb-2">
        <div>
          <h1 className="text-2xl font-semibold">Pending Receivables — Invoice-wise</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton />
          <ExportButton href={`/api/export/pending-receivables${exportQuery ? `?${exportQuery}` : ''}`} />
        </div>
      </div>

      <Suspense>
        <PendingReceivablesFilters customers={customerList} />
      </Suspense>

      {/* ── Summary ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Pending</p>
          <p className="text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">{formatPKR(totals.balance)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-1">Overdue</p>
          <p className="text-xl font-semibold tabular-nums text-red-600 dark:text-red-400">{formatPKR(totals.overdue)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {totals.balance > 0 ? `${Math.round((totals.overdue / totals.balance) * 100)}% of pending` : '—'}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-1">Pending Invoices</p>
          <p className="text-xl font-semibold tabular-nums">{totals.invoices}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-1">Customers</p>
          <p className="text-xl font-semibold tabular-nums">{totals.customers}</p>
        </div>
      </div>

      {/* ── Age profile: one bar, four segments ── */}
      {totals.balance > 0 && (
        <div className="rounded-lg border p-4 mb-6">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            {bucketCards.map((b) => totals.buckets[b.key] > 0 && (
              <div key={b.key} className={b.tone} style={{ width: `${(totals.buckets[b.key] / totals.balance) * 100}%` }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {bucketCards.map((b) => (
              <div key={b.key}>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`inline-block h-2 w-2 rounded-full ${b.tone}`} />{b.label}
                </p>
                <p className="tabular-nums font-medium">{formatPKR(totals.buckets[b.key])}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Table ── */}
      {customers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">
            {filters.customerId || filters.q || filters.status !== 'all' ? 'No pending invoices match these filters.' : 'No pending receivables — every invoice is settled.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Invoice</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Due</th>
                  <th className="text-right px-4 py-3 font-medium">Age</th>
                  <th className="text-right px-4 py-3 font-medium">Invoice Amt</th>
                  <th className="text-right px-4 py-3 font-medium">Returns / CN</th>
                  <th className="text-right px-4 py-3 font-medium">Received</th>
                  <th className="text-right px-4 py-3 font-medium">Adjusted (FIFO)</th>
                  <th className="text-right px-4 py-3 font-medium">Balance</th>
                </tr>
              </thead>
              {customers.map((c) => (
                <tbody key={c.customerId} className="divide-y border-b">
                  <tr className="bg-muted/30">
                    <td colSpan={8} className="px-4 py-2 font-semibold">
                      {c.customerName}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {c.rows.length} item{c.rows.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-amber-600 dark:text-amber-400">{formatPKR(c.total)}</td>
                  </tr>
                  {c.rows.map((r) => (
                    <tr key={r.key} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {r.isOpening ? (
                          <span className="italic text-muted-foreground">Opening balance</span>
                        ) : r.invoiceId ? (
                          <Link href={`/sales/invoice/${r.invoiceId}/report`} className="font-mono text-primary hover:underline print:no-underline print:text-foreground">
                            {r.serial ?? '—'}
                          </Link>
                        ) : (
                          <span className="font-mono">{r.serial ?? '—'}</span>
                        )}
                        {r.poNo && <span className="block text-xs text-muted-foreground">PO {r.poNo}</span>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap"><DueCell row={r} /></td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{r.age}d</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatPKR(r.amount)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{money(r.returned)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-green-700 dark:text-green-400">{money(r.received)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{money(r.fifo)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatPKR(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
              <tfoot className="bg-amber-50 dark:bg-amber-950/30">
                <tr className="font-semibold">
                  <td colSpan={4} className="px-4 py-3">Total Pending</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPKR(totals.amount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(totals.returned)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(totals.received)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(totals.fifo)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-700 dark:text-amber-400">{formatPKR(totals.balance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        <strong>Received</strong> is receipt money applied to that invoice on the receipt form.{' '}
        <strong>Adjusted (FIFO)</strong> is money not applied to any invoice — unapplied receipts, unlinked returns
        and credit notes — which settles the oldest invoices first. Age runs from the invoice date.
      </p>

      <div className="hidden print:block mt-8 pt-4 border-t text-xs text-muted-foreground text-center">
        Generated {formatPKTDate(new Date().toISOString())}
      </div>
    </div>
  )
}
