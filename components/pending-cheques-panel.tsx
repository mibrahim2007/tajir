import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { PDC_SOURCES, type PdcRegisterRow } from '@/lib/pdc/sources'

/**
 * Shows the post-dated cheques still outstanding, on the forms where you are
 * about to commit more money — so you can see what is already promised before
 * promising more.
 *
 * `direction` filters to one side: an entry form for money going out shows the
 * cheques you have written, not the ones customers have given you.
 */
export async function PendingChequesPanel({
  direction,
  limit = 8,
  className,
}: {
  direction?: 'in' | 'out'
  limit?: number
  className?: string
}) {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  let query = admin
    .from('pdc_register')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('pdc_status', 'pending')
  if (direction) query = query.eq('direction', direction)

  const { data } = await query
  const rows = ((data ?? []) as PdcRegisterRow[]).sort((a, b) => {
    // Soonest due first; cheques with no due date fall to the end.
    const ad = a.cheque_due_date ?? '9999-12-31'
    const bd = b.cheque_due_date ?? '9999-12-31'
    return ad === bd ? a.doc_date.localeCompare(b.doc_date) : ad.localeCompare(bd)
  })

  if (rows.length === 0) return null

  const total = rows.reduce((s, r) => s + Number(r.amount), 0)
  const today = new Date().toISOString().split('T')[0]
  const shown = rows.slice(0, limit)

  return (
    <div className={`rounded-lg border bg-muted/30 px-4 py-3 ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-sm font-semibold">
          {rows.length} post-dated cheque{rows.length !== 1 ? 's' : ''} still pending
          {direction === 'out' ? ' (issued)' : direction === 'in' ? ' (received)' : ''}
        </p>
        <span className="text-sm font-semibold tabular-nums">{formatPKR(total)}</span>
      </div>

      <ul className="divide-y text-sm">
        {shown.map((r) => {
          const overdue = !!r.cheque_due_date && r.cheque_due_date < today
          return (
            <li key={`${r.source}-${r.line_id}`} className="flex items-center justify-between gap-3 py-1.5">
              <span className="min-w-0">
                <span className="font-mono text-xs">{r.cheque_number ?? '—'}</span>
                <span className="text-muted-foreground"> · {r.party_name ?? PDC_SOURCES[r.source].label}</span>
                {r.cheque_due_date && (
                  <span className={overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                    {' '}· due {formatPKTDate(r.cheque_due_date + 'T00:00:00')}{overdue ? ' (overdue)' : ''}
                  </span>
                )}
              </span>
              <span className="tabular-nums whitespace-nowrap">{formatPKR(Number(r.amount))}</span>
            </li>
          )
        })}
      </ul>

      <div className="flex items-center justify-between mt-2">
        {rows.length > shown.length && (
          <span className="text-xs text-muted-foreground">+{rows.length - shown.length} more</span>
        )}
        <Link
          href="/reports/pdc-register"
          className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground ml-auto"
        >
          Open cheque register
        </Link>
      </div>
    </div>
  )
}
