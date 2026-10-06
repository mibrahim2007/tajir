import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { EditSupplierForm } from '../../edit-supplier-form'

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  // Editing was owner-only on the list (RoleGate) — keep it that way here.
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()
  const { data: supplier } = await admin
    .from('suppliers')
    .select('id, name, email, opening_balance, opening_balance_currency, opening_balance_pkr_equivalent')
    .eq('id', id).eq('tenant_id', tenantId).maybeSingle()

  if (!supplier) notFound()

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit Supplier</h1>
        <p className="text-sm text-muted-foreground mt-1">Update contact details and opening balance.</p>
      </div>
      <EditSupplierForm
        id={supplier.id}
        currentName={supplier.name}
        currentEmail={supplier.email}
        currentOpeningBalance={supplier.opening_balance ?? 0}
        currentOpeningBalanceCurrency={supplier.opening_balance_currency ?? 'PKR'}
        currentOpeningBalancePkr={supplier.opening_balance_pkr_equivalent ?? 0}
      />
    </div>
  )
}
