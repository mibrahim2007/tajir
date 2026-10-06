import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { EditCustomerForm } from '../../edit-customer-form'

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  // Editing was owner-only on the list (RoleGate) — keep it that way here.
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()
  const { data: customer } = await admin
    .from('tajir_customers')
    .select('id, name, email, phone, status, opening_balance, opening_balance_currency, opening_balance_pkr_equivalent')
    .eq('id', id).eq('tenant_id', tenantId).maybeSingle()

  if (!customer) notFound()

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit Customer</h1>
        <p className="text-sm text-muted-foreground mt-1">Update contact details, status and opening balance.</p>
      </div>
      <EditCustomerForm
        id={customer.id}
        currentName={customer.name}
        currentEmail={customer.email}
        currentPhone={customer.phone ?? null}
        currentStatus={customer.status}
        currentOpeningBalance={customer.opening_balance ?? 0}
        currentOpeningBalanceCurrency={customer.opening_balance_currency ?? 'PKR'}
        currentOpeningBalancePkr={customer.opening_balance_pkr_equivalent ?? 0}
      />
    </div>
  )
}
