import { notFound } from 'next/navigation'
import { PeriodLockBanner } from '@/components/period-lock-banner'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { listEndorsableCheques } from '@/lib/pdc/endorsement'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'
import { DisburseLoanForm } from '../disburse-loan-form'

export default async function DisburseEmployeeLoanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  // Disbursing a loan was owner-only on the ledger (RoleGate).
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: employee } = await admin
    .from('employees')
    .select('id, name')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!employee) notFound()

  const [{ data: rawBanks }, nextSerial, endorsableCheques] = await Promise.all([
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
    peekNextDocumentSerial(admin, tenantId, 'employee_loan', today),
    // Received cheques that could be handed straight to the employee.
    listEndorsableCheques(tenantId),
  ])

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <PeriodLockBanner className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Disburse Loan / Advance</h1>
        <p className="text-sm text-muted-foreground mt-1">Pay a loan or advance to {employee.name}. Interest-free.</p>
      </div>
      <DisburseLoanForm
        employeeId={id}
        today={today}
        nextSerial={nextSerial}
        banks={rawBanks ?? []}
        endorsableCheques={endorsableCheques}
        returnPath={`/employees/${id}/ledger`}
      />
    </div>
  )
}
