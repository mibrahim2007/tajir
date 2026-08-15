'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { formatPKR } from '@/lib/utils/currency'
import { formatCommissionRate, type CommissionType } from '@/lib/agents/commission'
import { setAgentActiveAction } from '@/app/actions/edit-agent'
import { deleteAgentAction } from '@/app/actions/delete-agent'
import { AgentForm, type AgentFormValues } from './agent-form'

export type AgentListItem = {
  id: string
  name: string
  agentCode: string | null
  phone: string | null
  city: string | null
  isActive: boolean
  saleCommissionType: CommissionType
  saleCommissionRate: number
  purchaseCommissionType: CommissionType
  purchaseCommissionRate: number
  /** Commission accrued, including the opening balance. */
  earned: number
  paid: number
  outstanding: number
  /** Everything the edit sheet needs, prepared server-side. */
  form: AgentFormValues
}

export function AgentsList({ agents }: { agents: AgentListItem[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [showRetired, setShowRetired] = useState(false)
  const [isPending, startTransition] = useTransition()
  // Two-click confirm, matching the ledger rows: the first click arms the row,
  // the second acts. Avoids a blocking browser dialog.
  const [armedId, setArmedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    let list = showRetired ? agents : agents.filter((a) => a.isActive)
    if (q) {
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.agentCode ?? '').toLowerCase().includes(q) ||
          (a.city ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [agents, q, showRetired])

  const totals = filtered.reduce(
    (acc, a) => ({
      earned: acc.earned + a.earned,
      paid: acc.paid + a.paid,
      outstanding: acc.outstanding + a.outstanding,
    }),
    { earned: 0, paid: 0, outstanding: 0 },
  )

  const retiredCount = agents.filter((a) => !a.isActive).length

  const onToggleActive = (a: AgentListItem) => {
    startTransition(async () => {
      setError(null)
      const result = await setAgentActiveAction({ id: a.id, isActive: !a.isActive })
      if (!result.success) { setError(result.error); return }
      router.refresh()
    })
  }

  const onDelete = (id: string) => {
    if (armedId !== id) { setArmedId(id); setError(null); return }
    startTransition(async () => {
      setError(null)
      const result = await deleteAgentAction({ id })
      setArmedId(null)
      if (!result.success) { setError(result.error); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Input
          type="search"
          placeholder="Filter by name, code or city…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs min-h-[44px]"
        />
        <div className="flex items-center gap-3">
          {q && <p className="text-xs text-muted-foreground whitespace-nowrap">{filtered.length} of {agents.length}</p>}
          {retiredCount > 0 && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
              Show retired ({retiredCount})
            </label>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-12 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            {q ? <>No agents match &ldquo;{query}&rdquo;.</> : 'No active agents.'}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Agent</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">On Sales</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">On Purchases</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Earned</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Paid</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Outstanding</th>
                <th className="px-4 py-3 w-44" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium">{a.name}</span>
                    {a.agentCode && <span className="text-muted-foreground text-xs ml-2 font-mono">{a.agentCode}</span>}
                    {!a.isActive && (
                      <span className="text-xs ml-2 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Retired</span>
                    )}
                    {(a.city || a.phone) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[a.city, a.phone].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {formatCommissionRate(a.saleCommissionType, a.saleCommissionRate)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {formatCommissionRate(a.purchaseCommissionType, a.purchaseCommissionRate)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPKR(a.earned)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPKR(a.paid)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {a.outstanding > 0 ? (
                      <span className="text-amber-700 dark:text-amber-400">{formatPKR(a.outstanding)}</span>
                    ) : a.outstanding < 0 ? (
                      // Paid more than has accrued — an advance against future
                      // commission, which is normal, not an error.
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Advance</span>
                        {formatPKR(Math.abs(a.outstanding))}
                      </span>
                    ) : (
                      formatPKR(0)
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/agents/${a.id}/ledger`}
                        className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
                      >
                        Ledger
                      </Link>
                      <AgentForm agent={a.form} />
                      <button
                        type="button"
                        onClick={() => onToggleActive(a)}
                        disabled={isPending}
                        className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        {a.isActive ? 'Retire' : 'Reinstate'}
                      </button>
                      {/* Only ever succeeds for an agent who has never traded;
                          the action refuses the rest and says to retire instead. */}
                      <button
                        type="button"
                        onClick={() => onDelete(a.id)}
                        onBlur={() => armedId === a.id && setArmedId(null)}
                        disabled={isPending}
                        className={`text-xs underline underline-offset-4 disabled:opacity-50 ${
                          armedId === a.id ? 'text-destructive font-semibold' : 'text-muted-foreground hover:text-destructive'
                        }`}
                      >
                        {armedId === a.id ? 'Confirm?' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 1 && (
              <tfoot className="border-t bg-muted/30">
                <tr className="font-medium">
                  <td className="px-4 py-3" colSpan={3}>Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPKR(totals.earned)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPKR(totals.paid)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPKR(totals.outstanding)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
