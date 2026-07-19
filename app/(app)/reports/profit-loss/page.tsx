import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeProfitAndLoss } from '@/lib/reports/profit-loss'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { PrintButton } from '@/components/print-button'
import { ProfitLossFilters } from './profit-loss-filters'
import { Suspense } from 'react'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function parseDate(val: unknown, fallback: string): string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val : fallback
}

function SectionTable({ title, rows, netLabel, net, netClassName }: {
  title: string
  rows: { code: string; name: string; amount: number }[]
  netLabel: string
  net: number
  netClassName?: string
}) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="bg-muted/50 border-b px-4 py-2">
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.code} className="hover:bg-muted/20">
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground w-20">{row.code}</td>
              <td className="px-4 py-2.5">{row.name}</td>
              <td className="px-4 py-2.5 text-right tabular-nums w-40">
                {row.amount !== 0 ? formatPKR(row.amount) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t bg-muted/20">
          <tr className={`font-semibold text-sm ${netClassName ?? ''}`}>
            <td className="px-4 py-2.5" colSpan={2}>{netLabel}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{formatPKR(net)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function SubtotalRow({ label, amount, className }: { label: string; amount: number; className?: string }) {
  return (
    <div className={`rounded-lg border px-4 py-3 flex items-center justify-between font-semibold text-sm ${className ?? 'bg-muted/30'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatPKR(amount)}</span>
    </div>
  )
}

export default async function ProfitLossPage({ searchParams }: { searchParams: SearchParams }) {
  const { tenantId } = await requireAuth()
  const params = await searchParams

  const today = new Date().toISOString().split('T')[0]
  const firstOfYear = today.slice(0, 4) + '-01-01'
  const from = parseDate(params.from, firstOfYear)
  const to = parseDate(params.to, today)

  const admin = createAdminClient()

  // Shared with the profit-allocation action so the allocated figure can never
  // disagree with the one shown here.
  const {
    revenue, costOfSales,
    operatingExpenses: opexRows,
    financialCharges: finCharges,
    totalRevenue,
    totalCostOfSales: totalCOS,
    grossProfit,
    totalOperatingExpenses: totalOpex,
    operatingProfit,
    totalFinancialCharges: totalFinCharges,
    netProfit,
    hasData,
  } = await computeProfitAndLoss({ admin, tenantId, from, to })

  const dateLabel = `${formatPKTDate(from + 'T00:00:00')} – ${formatPKTDate(to + 'T00:00:00')}`

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-6 print:mb-2">
        <div>
          <h1 className="text-2xl font-semibold">Profit & Loss</h1>
          <p className="text-sm text-muted-foreground mt-1">{dateLabel}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton />
        </div>
      </div>

      <Suspense>
        <ProfitLossFilters from={from} to={to} />
      </Suspense>

      {!hasData ? (
        <div className="rounded-lg border border-dashed p-12 text-center mt-4">
          <p className="text-muted-foreground text-sm">
            No GL entries in this date range.
          </p>
        </div>
      ) : (
        <div className="space-y-3 mt-4">
          {revenue.length > 0 && (
            <SectionTable
              title="Revenue"
              rows={revenue.filter((r) => r.amount !== 0)}
              netLabel="Total Revenue"
              net={totalRevenue}
            />
          )}

          {costOfSales.length > 0 && (
            <SectionTable
              title="Cost of Sales"
              rows={costOfSales.filter((r) => r.amount !== 0)}
              netLabel="Total Cost of Sales"
              net={totalCOS}
            />
          )}

          <SubtotalRow
            label="Gross Profit"
            amount={grossProfit}
            className={grossProfit >= 0
              ? 'bg-green-50 dark:bg-green-950/30 border-green-200 text-green-800 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-950/30 border-destructive text-destructive'}
          />

          {opexRows.length > 0 && (
            <SectionTable
              title="Operating Expenses"
              rows={opexRows.filter((r) => r.amount !== 0)}
              netLabel="Total Operating Expenses"
              net={totalOpex}
            />
          )}

          <SubtotalRow
            label="Operating Profit"
            amount={operatingProfit}
            className={operatingProfit >= 0
              ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 text-blue-800 dark:text-blue-300'
              : 'bg-red-50 dark:bg-red-950/30 border-destructive text-destructive'}
          />

          {finCharges.length > 0 && (
            <SectionTable
              title="Financial Charges"
              rows={finCharges.filter((r) => r.amount !== 0)}
              netLabel="Total Financial Charges"
              net={totalFinCharges}
            />
          )}

          <div className={`rounded-lg border px-4 py-4 flex items-center justify-between font-bold text-base ${
            netProfit >= 0
              ? 'bg-green-50 dark:bg-green-950/30 border-green-300 text-green-900 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-950/30 border-destructive text-destructive'
          }`}>
            <span>{netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</span>
            <span className="tabular-nums">{formatPKR(Math.abs(netProfit))}</span>
          </div>
        </div>
      )}

      <div className="hidden print:block mt-8 pt-4 border-t text-xs text-muted-foreground text-center">
        Profit & Loss · {dateLabel} · Generated {formatPKTDate(new Date().toISOString())}
      </div>
    </div>
  )
}
