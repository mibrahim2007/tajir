import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateVoucherForm } from './create-voucher-form'
import Link from 'next/link'

export default async function NewVoucherPage() {
  const { tenantId, role } = await requireAuth()

  if (role !== 'owner') {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <p className="text-muted-foreground">Only owners can create journal vouchers.</p>
        <Link href="/vouchers" className="text-sm underline mt-2 block">Back to Vouchers</Link>
      </div>
    )
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawAccounts }, { data: rawCustomers }, { data: rawSuppliers }, { data: rawLots }, { data: rawBanks }] = await Promise.all([
    admin.from('chart_of_accounts')
      .select('id, code, name, account_type, is_header')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('code'),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
  ])

  const accounts = (rawAccounts ?? []).filter((a) => !a.is_header)
  const customers = rawCustomers ?? []
  const suppliers = rawSuppliers ?? []
  const lots = rawLots ?? []
  const banks = rawBanks ?? []

  if (accounts.length === 0) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <p className="text-muted-foreground mb-2">Chart of accounts not set up yet.</p>
        <Link href="/accounts" className="text-sm underline">Go to Accounts to seed the standard CoA</Link>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Journal Voucher</h1>
        <p className="text-sm text-muted-foreground mt-1">Debits must equal credits. Minimum 2 lines.</p>
      </div>
      <CreateVoucherForm
        today={today}
        accounts={accounts}
        customers={customers}
        suppliers={suppliers}
        lots={lots}
        banks={banks}
      />
    </div>
  )
}
