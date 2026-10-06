import { notFound } from 'next/navigation'
import { PeriodLockBanner } from '@/components/period-lock-banner'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'
import { formatPKTDate } from '@/lib/utils/dates'
import { RecordRepaymentForm } from '../record-repayment-form'

export default async function RecordRepaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: employee } = await admin
    .from('employees')
    .select('id, name')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!employee) notFound()

  const [{ data: rawBanks }, { data: rawLoans }, nextSerial] = await Promise.all([
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
    admin.from('employee_loans').select('id, serial_number, principal, currency_code, disbursement_date')
      .eq('employee_id', id).eq('tenant_id', tenantId).eq('status', 'active').order('disbursement_date', { ascending: true }),
    peekNextDocumentSerial(admin, tenantId, 'loan_repayment', today),
  ])

  const loanOptions = (rawLoans ?? []).map((l) => ({
    id: l.id,
    label: `${l.serial_number ? `${l.serial_number} · ` : ''}${l.currency_code} ${Number(l.principal).toLocaleString()} · ${formatPKTDate(new Date(l.disbursement_date))}`,
  }))

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <PeriodLockBanner className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Record Repayment</h1>
        <p className="text-sm text-muted-foreground mt-1">Record a loan installment or repayment received from {employee.name}.</p>
      </div>
      <RecordRepaymentForm employeeId={id} today={today} nextSerial={nextSerial} banks={rawBanks ?? []} loans={loanOptions} />
    </div>
  )
}
