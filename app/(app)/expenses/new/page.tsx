import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateExpenseForm } from './create-expense-form'

export default async function NewExpensePage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: rawAccounts } = await admin
    .from('chart_of_accounts')
    .select('id, code, name, account_type')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('is_header', false)
    .eq('account_type', 'expense')
    .order('code')

  const accounts = rawAccounts ?? []

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">New Expense</h1>
        <p className="text-sm text-muted-foreground mt-1">Record a cash expense against an expense account.</p>
      </div>
      {accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">
            No expense accounts found. Go to <a href="/accounts" className="underline">Accounts</a> and seed the chart of accounts first.
          </p>
        </div>
      ) : (
        <CreateExpenseForm today={today} accounts={accounts} />
      )}
    </div>
  )
}
