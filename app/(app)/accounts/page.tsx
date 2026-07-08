import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { SeedAccountsButton } from './seed-accounts-button'
import { UploadCoaButton } from './upload-coa-button'
import { AddAccountButton } from './add-account-button'
import { AccountRowActions } from './account-row-actions'
import { AccountOpeningBalanceButton } from './account-opening-balance-button'

const TYPE_LABELS: Record<string, string> = {
  asset:     'Asset',
  liability: 'Liability',
  equity:    'Equity',
  revenue:   'Revenue',
  expense:   'Expense',
}

const TYPE_COLORS: Record<string, string> = {
  asset:     'bg-blue-50 text-blue-700 border-blue-200',
  liability: 'bg-red-50 text-red-700 border-red-200',
  equity:    'bg-purple-50 text-purple-700 border-purple-200',
  revenue:   'bg-green-50 text-green-700 border-green-200',
  expense:   'bg-orange-50 text-orange-700 border-orange-200',
}

export default async function AccountsPage() {
  const { tenantId, role } = await requireAuth()
  const admin = createAdminClient()

  const { data: rawAccounts } = await admin
    .from('chart_of_accounts')
    .select('id, code, name, account_type, parent_code, is_header, is_system, is_active')
    .eq('tenant_id', tenantId)
    .order('code')

  const accounts = rawAccounts ?? []
  const pickerAccounts = accounts.map((a) => ({ code: a.code, name: a.name, parent_code: a.parent_code }))

  // Opening balances are stored as `opening_balance` journal entries (one per
  // account, offset against Opening Balance Equity). Read them back so we can
  // show the current amount on each row and prefill the editor.
  const { data: obEntries } = await admin
    .from('tajir_journal_entries')
    .select('id, date, source_id')
    .eq('tenant_id', tenantId)
    .eq('source_type', 'opening_balance')

  const sourceByEntry = new Map((obEntries ?? []).map((e) => [e.id, e.source_id]))
  const dateByEntry = new Map((obEntries ?? []).map((e) => [e.id, e.date]))
  const openingByAccount = new Map<string, { amount: number; date: string }>()
  const obEntryIds = (obEntries ?? []).map((e) => e.id)
  if (obEntryIds.length > 0) {
    const { data: obLines } = await admin
      .from('tajir_journal_entry_lines')
      .select('journal_entry_id, account_id, debit, credit')
      .in('journal_entry_id', obEntryIds)
    for (const line of obLines ?? []) {
      // The target account's leg is the one whose account matches the entry's source_id
      // (the other leg is the Opening Balance Equity contra).
      if (line.account_id === sourceByEntry.get(line.journal_entry_id)) {
        openingByAccount.set(line.account_id, {
          amount: Number(line.debit) + Number(line.credit),
          date:   dateByEntry.get(line.journal_entry_id) as string,
        })
      }
    }
  }

  // Group top-level sections (no parent)
  const topLevel = accounts.filter((a) => !a.parent_code)
  const byParent = new Map<string, typeof accounts>()
  for (const a of accounts) {
    if (a.parent_code) {
      const list = byParent.get(a.parent_code) ?? []
      list.push(a)
      byParent.set(a.parent_code, list)
    }
  }

  function renderChildren(parentCode: string, depth: number): React.ReactNode {
    const children = byParent.get(parentCode) ?? []
    return children.map((child) => (
      <div key={child.id}>
        <div
          className={`flex items-center gap-3 py-2 px-4 border-b last:border-b-0 hover:bg-secondary/50 transition-colors ${!child.is_active ? 'opacity-50' : ''}`}
          style={{ paddingLeft: `${(depth + 1) * 20}px` }}
        >
          <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">{child.code}</span>
          <span className={`text-sm ${child.is_header ? 'font-semibold' : ''}`}>{child.name}</span>
          <div className="ml-auto flex items-center gap-2">
            {(openingByAccount.get(child.id)?.amount ?? 0) > 0 && (
              <span className="text-xs tabular-nums text-emerald-700 dark:text-emerald-400" title="Opening balance">
                {formatPKR(openingByAccount.get(child.id)!.amount)}
              </span>
            )}
            {role === 'owner' && !child.is_header && (
              <AccountOpeningBalanceButton
                account={{ id: child.id, code: child.code, name: child.name, account_type: child.account_type }}
                current={openingByAccount.get(child.id) ?? null}
              />
            )}
            {child.is_system ? (
              <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">system</span>
            ) : (
              <>
                {!child.is_active && (
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground border rounded px-1.5 py-0.5">inactive</span>
                )}
                {role === 'owner' && <AccountRowActions account={child} accounts={pickerAccounts} />}
              </>
            )}
          </div>
        </div>
        {renderChildren(child.code, depth + 1)}
      </div>
    ))
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">Pakistani standard CoA (ICAP/SECP) — {accounts.length} accounts</p>
        </div>
        {role === 'owner' && (
          <div className="flex items-center gap-2">
            <AddAccountButton accounts={accounts.map((a) => ({ code: a.code, name: a.name, account_type: a.account_type }))} />
            <UploadCoaButton />
            {accounts.length === 0 && <SeedAccountsButton />}
          </div>
        )}
      </div>

      {accounts.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm mb-4">No accounts yet. Click above to seed the standard Pakistani chart of accounts.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {topLevel.map((section) => (
            <div key={section.id} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className={`flex items-center gap-3 px-4 py-3 border-b ${TYPE_COLORS[section.account_type] ?? ''}`}>
                <span className="font-mono text-xs w-16 shrink-0 opacity-70">{section.code}</span>
                <span className="font-bold text-sm uppercase tracking-wide">{section.name}</span>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs font-medium capitalize">{TYPE_LABELS[section.account_type]}</span>
                  {role === 'owner' && !section.is_system && (
                    <AccountRowActions account={section} accounts={pickerAccounts} />
                  )}
                </div>
              </div>
              <div className="bg-background">
                {renderChildren(section.code, 0)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
