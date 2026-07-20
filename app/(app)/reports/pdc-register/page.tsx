import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { PrintButton } from '@/components/print-button'
import { type PdcRegisterRow } from '@/lib/pdc/sources'
import { PdcRegisterTable } from './pdc-register-table'

export default async function PdcRegisterPage() {
  const { tenantId, role } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data }, { data: banks }] = await Promise.all([
    admin.from('pdc_register').select('*').eq('tenant_id', tenantId),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
  ])

  const rows = ((data ?? []) as PdcRegisterRow[]).sort((a, b) => {
    const ad = a.cheque_due_date ?? '9999-12-31'
    const bd = b.cheque_due_date ?? '9999-12-31'
    return ad === bd ? a.doc_date.localeCompare(b.doc_date) : ad.localeCompare(bd)
  })

  // Dates are formatted HERE, not in the client table. Formatting in the client
  // component made the server and client markup differ and broke hydration,
  // which silently left the Settle buttons inert.
  const viewRows = rows.map((r) => ({
    ...r,
    dueLabel: r.cheque_due_date ? formatPKTDate(r.cheque_due_date + 'T00:00:00') : null,
    overdue: r.pdc_status === 'pending' && !!r.cheque_due_date && r.cheque_due_date < today,
  }))

  const pending = rows.filter((r) => r.pdc_status === 'pending')
  const sum = (rs: PdcRegisterRow[]) => rs.reduce((s, r) => s + Number(r.amount), 0)

  const inHand = sum(pending.filter((r) => r.direction === 'in'))
  const issued = sum(pending.filter((r) => r.direction === 'out'))
  const overdue = pending.filter((r) => r.cheque_due_date && r.cheque_due_date < today)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6 print:mb-2">
        <div>
          <h1 className="text-2xl font-semibold">Cheque Register</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Post-dated cheques and their status. Clearing a cheque moves it out of
            Post-Dated Cheques (1112) into the bank.
          </p>
        </div>
        <div className="flex gap-2 print:hidden"><PrintButton /></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-2xl border shadow-sm px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pending — received</p>
          <p className="text-xl font-extrabold tabular-nums mt-1">{formatPKR(inHand)}</p>
        </div>
        <div className="bg-card rounded-2xl border shadow-sm px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pending — issued</p>
          <p className="text-xl font-extrabold tabular-nums mt-1 text-amber-600 dark:text-amber-400">{formatPKR(issued)}</p>
        </div>
        <div className="bg-card rounded-2xl border shadow-sm px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Overdue</p>
          <p className={`text-xl font-extrabold tabular-nums mt-1 ${overdue.length ? 'text-destructive' : ''}`}>
            {overdue.length}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No post-dated cheques recorded.</p>
        </div>
      ) : (
        <PdcRegisterTable rows={viewRows} banks={banks ?? []} today={today} canSettle={role === 'owner'} />
      )}
    </div>
  )
}
