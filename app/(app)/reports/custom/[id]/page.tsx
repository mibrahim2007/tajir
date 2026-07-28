import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { Pencil, AlertTriangle } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchReportDefinition, computeCustomReport } from '@/lib/reports/custom-report'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { PrintButton } from '@/components/print-button'
import { ExportButton } from '@/components/export-button'
import { Button } from '@/components/ui/button'
import { CustomReportFilters } from './custom-report-filters'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function parseDate(val: unknown, fallback: string): string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val : fallback
}

export default async function CustomReportViewPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { tenantId, role } = await requireAuth()
  const { id } = await params
  const sp = await searchParams

  const admin = createAdminClient()
  const definition = await fetchReportDefinition({ admin, tenantId, reportId: id })
  if (!definition) notFound()

  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 8) + '01'
  const from = parseDate(sp.from, firstOfMonth)
  const to = parseDate(sp.to, today)

  const report = await computeCustomReport({ admin, tenantId, definition, from, to })

  const periodLabel = definition.basis === 'period'
    ? `${formatPKTDate(from + 'T00:00:00')} — ${formatPKTDate(to + 'T00:00:00')}`
    : `As of ${formatPKTDate(to + 'T00:00:00')}`

  const exportHref = `/api/export/custom-report?id=${id}&from=${from}&to=${to}`

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-6 print:mb-2 gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{definition.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{periodLabel}</p>
          {definition.description && (
            <p className="text-sm text-muted-foreground mt-1">{definition.description}</p>
          )}
        </div>
        <div className="flex gap-2 print:hidden shrink-0">
          {role === 'owner' && (
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link href={`/reports/custom/${id}/edit`}><Pencil className="h-4 w-4 mr-2" />Edit Layout</Link>
            </Button>
          )}
          <ExportButton href={exportHref} />
          <PrintButton />
        </div>
      </div>

      <Suspense>
        <CustomReportFilters basis={definition.basis} from={from} to={to} />
      </Suspense>

      {!report.hasData ? (
        <div className="rounded-lg border border-dashed p-12 text-center mt-4">
          <p className="text-muted-foreground text-sm">No GL entries found for this period.</p>
        </div>
      ) : report.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center mt-4">
          <p className="text-muted-foreground text-sm">
            Every line came out empty for this period.
            {definition.hideZeroRows && ' Turn off “Hide zero rows” in the layout to see them anyway.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden mt-4">
          <table className="w-full text-sm">
            <tbody>
              {report.rows.map((row) => {
                if (row.kind === 'spacer') {
                  return <tr key={row.key}><td colSpan={3} className="h-3" /></tr>
                }

                if (row.kind === 'header') {
                  return (
                    <tr key={row.key} className="bg-muted/50 border-y">
                      <td colSpan={3} className="px-4 py-2 font-semibold text-sm uppercase tracking-wide"
                          style={{ paddingLeft: `${16 + row.indent * 16}px` }}>
                        {row.label}
                      </td>
                    </tr>
                  )
                }

                const isDetail = row.kind === 'detail'
                return (
                  <tr
                    key={row.key}
                    className={[
                      'border-b last:border-b-0',
                      isDetail ? 'text-muted-foreground' : '',
                      row.kind === 'subtotal' ? 'bg-muted/20' : '',
                    ].join(' ')}
                  >
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground w-20">{row.code ?? ''}</td>
                    <td
                      className={row.isBold ? 'px-4 py-2 font-semibold' : 'px-4 py-2'}
                      style={{ paddingLeft: `${16 + row.indent * 16}px` }}
                    >
                      {row.label}
                      {row.error && (
                        <span className="ml-2 text-xs text-destructive">({row.error})</span>
                      )}
                    </td>
                    <td
                      className={[
                        'px-4 py-2 text-right tabular-nums w-40',
                        row.isBold ? 'font-semibold' : '',
                        row.underline ? 'border-t-2 border-foreground/40' : '',
                        (row.amount ?? 0) < 0 ? 'text-destructive' : '',
                      ].join(' ')}
                    >
                      {row.amount === null ? '' : row.amount !== 0 ? formatPKR(row.amount) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {report.unmapped.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 mt-4 overflow-hidden print:hidden">
          <div className="px-4 py-2 border-b border-amber-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold">
              {report.unmapped.length} account{report.unmapped.length === 1 ? '' : 's'} with a balance are not on this report
            </span>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-amber-200">
              {report.unmapped.map((a) => (
                <tr key={a.code}>
                  <td className="px-4 py-1.5 font-mono text-xs w-20">{a.code}</td>
                  <td className="px-4 py-1.5">{a.name}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums w-40">{formatPKR(a.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-muted-foreground border-t border-amber-200">
            Amounts shown as debit-positive. Map them to a line, or ignore this if the report is meant to be partial.
          </p>
        </div>
      )}

      <div className="hidden print:block mt-8 pt-4 border-t text-xs text-muted-foreground text-center">
        {definition.name} · {periodLabel} · Generated {formatPKTDate(new Date().toISOString())}
      </div>
    </div>
  )
}
