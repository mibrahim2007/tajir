import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { AllocateProfitForm } from './allocate-profit-form'
import { AllocationsList } from './allocations-list'

export default async function ProfitAllocationPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const today = new Date().toISOString().split('T')[0]
  const firstOfYear = today.slice(0, 4) + '-01-01'

  const [{ data: rawAllocs }, { data: rawOwners }] = await Promise.all([
    admin.from('profit_allocations')
      .select('id, serial_number, period_start, period_end, net_profit, notes')
      .eq('tenant_id', tenantId)
      .order('period_end', { ascending: false }),
    admin.from('owners')
      .select('id, name, profit_share_pct')
      .eq('tenant_id', tenantId).eq('is_active', true)
      .order('created_at'),
  ])

  const allocs = rawAllocs ?? []
  const owners = rawOwners ?? []

  const { data: rawLines } = allocs.length > 0
    ? await admin.from('profit_allocation_lines')
        .select('allocation_id, owner_id, share_pct, amount')
        .eq('tenant_id', tenantId)
        .in('allocation_id', allocs.map((a) => a.id))
    : { data: [] }

  const lines = rawLines ?? []
  const ownerNames = new Map(owners.map((o) => [o.id, o.name]))

  const allocationItems = allocs.map((a) => ({
    id: a.id,
    serialNumber: a.serial_number as string | null,
    periodStart: a.period_start as string,
    periodEnd: a.period_end as string,
    periodLabel: `${formatPKTDate(a.period_start + 'T00:00:00')} – ${formatPKTDate(a.period_end + 'T00:00:00')}`,
    netProfit: Number(a.net_profit),
    notes: a.notes as string | null,
    lines: lines
      .filter((l) => l.allocation_id === a.id)
      .map((l) => ({
        ownerId: l.owner_id as string,
        // An owner deactivated after the allocation is no longer in `owners`;
        // the historical line must still render.
        name: ownerNames.get(l.owner_id) ?? 'Former owner',
        sharePct: Number(l.share_pct),
        amount: Number(l.amount),
      })),
  }))

  const totalAllocated = allocationItems.reduce((s, a) => s + a.netProfit, 0)
  const totalShare = owners.reduce((s, o) => s + Number(o.profit_share_pct), 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <Link href="/owners" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4">
            ← Owners
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1">Profit Allocation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Distribute a period&rsquo;s net profit to owners by share %
            {allocationItems.length > 0 && ` · ${formatPKR(totalAllocated)} allocated to date`}
          </p>
        </div>
        {owners.length > 0 && <AllocateProfitForm defaultFrom={firstOfYear} defaultTo={today} />}
      </div>

      {owners.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            Add owners with profit shares before allocating profit.{' '}
            <Link href="/owners" className="underline underline-offset-4">Go to Owners</Link>
          </p>
        </div>
      ) : (
        <>
          {Math.abs(totalShare - 100) > 0.01 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              Active owners&rsquo; profit shares total {totalShare.toFixed(2)}%, not 100%. Allocation is blocked until this is fixed.
            </div>
          )}

          {allocationItems.length === 0 ? (
            <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
              <p className="text-muted-foreground text-sm">No profit allocated yet.</p>
            </div>
          ) : (
            <AllocationsList allocations={allocationItems} />
          )}
        </>
      )}
    </div>
  )
}
