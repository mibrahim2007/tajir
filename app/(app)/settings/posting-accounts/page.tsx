import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKTDateTime } from '@/lib/utils/dates'
import { POSTING_PROCESSES } from '@/lib/accounting/posting-rules'
import { PostingAccountsForm, type PostingAccount } from './posting-accounts-form'

const ACTION_LABEL = { insert: 'Changed from standard', update: 'Changed', delete: 'Back to standard' } as const
const ACTION_TONE = {
  insert: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  update: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
  delete: 'bg-muted text-muted-foreground',
} as const

export default async function PostingAccountsPage() {
  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') redirect('/dashboard')

  const admin = createAdminClient()
  const [{ data: rawAccounts }, { data: rawOverrides }, { data: history }] = await Promise.all([
    admin.from('chart_of_accounts')
      .select('id, code, name, account_type, system_key, is_active, is_header')
      .eq('tenant_id', tenantId)
      .order('code'),
    admin.from('posting_account_overrides')
      .select('process, system_key, account_id')
      .eq('tenant_id', tenantId),
    admin.from('posting_account_override_history')
      .select('id, action, process, system_key, old_account_label, new_account_label, changed_by_label, reason, changed_at')
      .eq('tenant_id', tenantId)
      .order('changed_at', { ascending: false })
      .limit(100),
  ])

  // Postable accounts only; a standard head is kept even if someone switched
  // it off, so its row can still show what it defaults to.
  const accounts: PostingAccount[] = (rawAccounts ?? [])
    .filter((a) => !a.is_header && (a.is_active || a.system_key))
    .map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.account_type, systemKey: a.system_key, active: a.is_active }))

  const standardLabel = new Map(accounts.filter((a) => a.systemKey).map((a) => [a.systemKey!, `${a.code} · ${a.name}`]))

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

      {/* ── Change history ── */}
      <section className="mt-10">
        <h2 className="text-lg font-bold">Change history</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Every change to these settings, newest first (last 100).</p>
        {!history?.length ? (
          <div className="mt-3 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No changes yet — every head is on its standard account.
          </div>
        ) : (
          <div className="mt-3 rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">When</th>
                  <th className="text-left px-4 py-2.5 font-medium">By</th>
                  <th className="text-left px-4 py-2.5 font-medium">Process · Head</th>
                  <th className="text-left px-4 py-2.5 font-medium">Change</th>
                  <th className="text-left px-4 py-2.5 font-medium">From</th>
                  <th className="text-left px-4 py-2.5 font-medium">To</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((h) => {
                  const proc   = POSTING_PROCESSES.find((p) => p.process === h.process)
                  const head   = proc?.heads.find((x) => x.systemKey === h.system_key)
                  const std    = standardLabel.get(h.system_key)
                  const action = h.action as keyof typeof ACTION_LABEL
                  const standardCell = <span className="text-muted-foreground">Standard{std ? ` — ${std}` : ''}</span>
                  // The label is snapshotted at change time; it is only missing when the account itself was deleted.
                  const deletedCell  = <span className="italic text-muted-foreground">Deleted account</span>
                  return (
                    <tr key={h.id}>
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{formatPKTDateTime(h.changed_at)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{h.changed_by_label ?? <span className="italic text-muted-foreground">System</span>}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{proc?.label ?? h.process}</span>
                        <span className="block text-xs text-muted-foreground">{head ? `${head.side} · ${head.purpose}` : h.system_key}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_TONE[action]}`}>{ACTION_LABEL[action]}</span>
                        {h.reason && <span className="block text-xs text-muted-foreground mt-0.5">{h.reason}</span>}
                      </td>
                      <td className="px-4 py-2.5">{action === 'insert' ? standardCell : (h.old_account_label ?? deletedCell)}</td>
                      <td className="px-4 py-2.5">{action === 'delete' ? standardCell : (h.new_account_label ?? deletedCell)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
