import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { SeedAccountsButton } from './seed-accounts-button'
import { UploadCoaButton } from './upload-coa-button'

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
          {child.is_system && (
            <span className="ml-auto text-xs text-muted-foreground border rounded px-1.5 py-0.5">system</span>
          )}
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
                <span className="ml-auto text-xs font-medium capitalize">{TYPE_LABELS[section.account_type]}</span>
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
