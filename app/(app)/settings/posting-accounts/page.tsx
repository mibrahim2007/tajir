import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PostingAccountsForm, type PostingAccount } from './posting-accounts-form'

export default async function PostingAccountsPage() {
  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') redirect('/dashboard')

  const admin = createAdminClient()
  const [{ data: rawAccounts }, { data: rawOverrides }] = await Promise.all([
    admin.from('chart_of_accounts')
      .select('id, code, name, account_type, system_key, is_active, is_header')
      .eq('tenant_id', tenantId)
      .order('code'),
    admin.from('posting_account_overrides')
      .select('process, system_key, account_id')
      .eq('tenant_id', tenantId),
  ])

  // Postable accounts only; a standard head is kept even if someone switched
  // it off, so its row can still show what it defaults to.
  const accounts: PostingAccount[] = (rawAccounts ?? [])
    .filter((a) => !a.is_header && (a.is_active || a.system_key))
    .map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.account_type, systemKey: a.system_key, active: a.is_active }))

  const overrides: Record<string, string> = {}
  for (const o of rawOverrides ?? []) overrides[`${o.process}:${o.system_key}`] = o.account_id

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-extrabold tracking-tight">Posting Accounts</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Choose which account each business process debits and credits. Every head starts on the standard account;
        change only the ones your books need.
      </p>

      <div className="mt-4 rounded-lg border bg-muted/30 px-4 py-3 text-sm space-y-1 text-muted-foreground">
        <p>• A head can only be moved to an account of the same type — an asset for Accounts Receivable, revenue for Sales Revenue, and so on.</p>
        <p>• Changes apply to documents saved from now on, and to older documents when they are edited. Existing vouchers are not rewritten.</p>
        <p>• Cash, bank and cheque accounts are still chosen on each receipt, payment or refund.</p>
        <p>• Keep Stock in Trade, Accounts Receivable and Accounts Payable the same across related processes, otherwise a balance raised by one process will not be cleared by the other.</p>
      </div>

      <div className="mt-6">
        <PostingAccountsForm accounts={accounts} overrides={overrides} />
      </div>
    </div>
  )
}
