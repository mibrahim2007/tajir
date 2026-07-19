import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'
import { CreateOwnerForm } from './create-owner-form'
import { OwnerTransactionForm } from './owner-transaction-form'
import { OwnersList } from './owners-list'

export default async function OwnersPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: allOwners }, { data: allTxns }, { data: allBanks }] = await Promise.all([
    admin.from('owners').select('id, name, cnic, profit_share_pct, is_active, created_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    admin.from('owner_transactions').select('owner_id, txn_type, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
  ])

  const owners = allOwners ?? []
  const txns = allTxns ?? []
  const banks = allBanks ?? []

  const nextSerial = await peekNextDocumentSerial(admin, tenantId, 'owner_withdrawal', today)

  // Net capital = contributions in − drawings out. Negative means the owner has
  // drawn more than they put in, which is normal in a profitable year (profit
  // is not yet allocated to owners) — shown as "Overdrawn" rather than an error.
  const ownerItems = owners.map((o) => {
    const mine = txns.filter((t) => t.owner_id === o.id)
    const contributed = mine.filter((t) => t.txn_type === 'contribution').reduce((s, t) => s + t.pkr_equivalent, 0)
    const drawn = mine.filter((t) => t.txn_type === 'withdrawal').reduce((s, t) => s + t.pkr_equivalent, 0)
    return {
      id: o.id,
      name: o.name,
      cnic: o.cnic as string | null,
      profitSharePct: Number(o.profit_share_pct),
      isActive: o.is_active as boolean,
      contributed,
      drawn,
      net: contributed - drawn,
    }
  })

  const totalShare = ownerItems.filter((o) => o.isActive).reduce((s, o) => s + o.profitSharePct, 0)
  const ownerOptions = owners.filter((o) => o.is_active).map((o) => ({ id: o.id, name: o.name }))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Owners</h1>
          <p className="text-sm text-muted-foreground mt-1">{owners.length} owner{owners.length !== 1 ? 's' : ''} · capital &amp; drawings</p>
        </div>
        <div className="flex items-center gap-2">
          {owners.length > 0 && (
            <Link
              href="/owners/profit-allocation"
              className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground mr-1"
            >
              Profit Allocation
            </Link>
          )}
          {ownerOptions.length > 0 && (
            <OwnerTransactionForm owners={ownerOptions} today={today} nextSerial={nextSerial} banks={banks} />
          )}
          <CreateOwnerForm />
        </div>
      </div>

      {/* Shares are not forced to total 100 — partners get added over time, so a
          partial total is normal. Flag it only as a hint, never as a blocker. */}
      {ownerItems.length > 1 && Math.abs(totalShare - 100) > 0.01 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          Active owners&rsquo; profit shares total {totalShare.toFixed(2)}%, not 100%.
        </div>
      )}

      {owners.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            No owners yet. Add an owner to start recording capital contributions and withdrawals.
          </p>
        </div>
      ) : (
        <OwnersList owners={ownerItems} />
      )}
    </div>
  )
}
