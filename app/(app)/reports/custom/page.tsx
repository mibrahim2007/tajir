import Link from 'next/link'
import { FileSpreadsheet, CalendarRange, CalendarCheck } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKTDate } from '@/lib/utils/dates'
import { NewCustomReportButton } from './new-custom-report-button'
import { CustomReportRowActions } from './custom-report-row-actions'

export default async function CustomReportsPage() {
  const { tenantId, role } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: rawReports }, { data: rawAccounts }] = await Promise.all([
    admin.from('custom_reports')
      .select('id, name, description, basis, updated_at')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name'),
    admin.from('chart_of_accounts')
      .select('code')
      .eq('tenant_id', tenantId)
      .limit(1),
  ])

  const reports = rawReports ?? []
  const hasAccounts = (rawAccounts ?? []).length > 0

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Custom Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build your own financial statements — choose the reporting headers, map the account codes
            that roll into each, and set how every line behaves.
          </p>
        </div>
        {role === 'owner' && <NewCustomReportButton />}
      </div>

      {role === 'owner' && !hasAccounts && (
        <div className="rounded-2xl border border-dashed p-4 mb-4 text-sm text-muted-foreground">
          Your chart of accounts is empty. Seed it from{' '}
          <Link href="/accounts" className="underline">Chart of Accounts</Link> before building a report.
        </div>
      )}

      {reports.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">
            No custom reports yet.
            {role === 'owner'
              ? ' Create one from a template — Profit & Loss, Balance Sheet or blank — then edit it freely.'
              : ' Ask the account owner to create one.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {reports.map((r) => {
            const isPeriod = r.basis === 'period'
            const BasisIcon = isPeriod ? CalendarRange : CalendarCheck
            return (
              <div
                key={r.id as string}
                className="flex items-center gap-4 p-5 bg-card rounded-2xl border border-border shadow-sm hover:border-primary/40 transition-all group"
              >
                <Link href={`/reports/custom/${r.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                  <span className="h-10 w-10 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <FileSpreadsheet className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{r.name as string}</p>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">
                      {(r.description as string | null) || (isPeriod
                        ? 'Movement between two dates'
                        : 'Cumulative balances as of a date')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                      <BasisIcon className="h-3 w-3" />
                      {isPeriod ? 'Date range' : 'As of date'}
                      <span className="opacity-60">· updated {formatPKTDate(r.updated_at as string)}</span>
                    </p>
                  </div>
                </Link>
                {role === 'owner' && (
                  <CustomReportRowActions reportId={r.id as string} name={r.name as string} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
