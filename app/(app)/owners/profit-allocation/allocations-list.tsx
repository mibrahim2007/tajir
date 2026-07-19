'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatPKR } from '@/lib/utils/currency'
import { deleteProfitAllocationAction } from '@/app/actions/delete-profit-allocation'
import { reopenProfitAllocationAction } from '@/app/actions/reopen-profit-allocation'

export type AllocationItem = {
  id: string
  serialNumber: string | null
  periodStart: string
  periodEnd: string
  periodLabel: string
  netProfit: number
  notes: string | null
  status: 'active' | 'reversed'
  lines: { ownerId: string; name: string; sharePct: number; amount: number }[]
}

export function AllocationsList({ allocations }: { allocations: AllocationItem[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Two-click confirm per action: first click arms, second commits.
  const [armed, setArmed] = useState<{ id: string; action: 'delete' | 'reopen' } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isArmed = (id: string, action: 'delete' | 'reopen') =>
    armed?.id === id && armed.action === action

  const run = (id: string, action: 'delete' | 'reopen') => {
    if (!isArmed(id, action)) { setArmed({ id, action }); setError(null); return }
    startTransition(async () => {
      setError(null)
      const result = action === 'reopen'
        ? await reopenProfitAllocationAction({ id })
        : await deleteProfitAllocationAction({ id })
      setArmed(null)
      if (!result.success) { setError(result.error); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {allocations.map((a) => {
        const isProfit = a.netProfit > 0
        const reversed = a.status === 'reversed'
        return (
          <div
            key={a.id}
            className={`bg-card rounded-2xl border shadow-sm overflow-hidden ${
              reversed ? 'border-dashed opacity-70' : 'border-border'
            }`}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30">
              <div>
                <p className="font-medium flex items-center gap-2">
                  {a.periodLabel}
                  {reversed && (
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      Reversed
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-mono">{a.serialNumber ?? '—'}</span>
                  {a.notes && ` · ${a.notes}`}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {isProfit ? 'Net Profit' : 'Net Loss'}
                  </p>
                  <p className={`tabular-nums font-semibold ${
                    reversed ? 'line-through text-muted-foreground' : isProfit ? '' : 'text-destructive'
                  }`}>
                    {formatPKR(Math.abs(a.netProfit))}
                  </p>
                </div>

                {/* Reopening is the accounting-safe undo: it posts a reversing
                    entry and frees the period. Delete erases the record entirely
                    and is only for an allocation posted in error. */}
                {!reversed && (
                  <button
                    type="button"
                    onClick={() => run(a.id, 'reopen')}
                    onBlur={() => isArmed(a.id, 'reopen') && setArmed(null)}
                    disabled={isPending}
                    className={`text-xs underline underline-offset-4 disabled:opacity-50 ${
                      isArmed(a.id, 'reopen') ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {isArmed(a.id, 'reopen') ? 'Confirm reopen?' : 'Reopen Period'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => run(a.id, 'delete')}
                  onBlur={() => isArmed(a.id, 'delete') && setArmed(null)}
                  disabled={isPending}
                  className={`text-xs underline underline-offset-4 disabled:opacity-50 ${
                    isArmed(a.id, 'delete') ? 'text-destructive font-semibold' : 'text-muted-foreground hover:text-destructive'
                  }`}
                >
                  {isArmed(a.id, 'delete') ? 'Confirm?' : 'Delete'}
                </button>
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {a.lines.map((l) => (
                  <tr key={l.ownerId}>
                    <td className="px-4 py-2">{l.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground w-24">
                      {l.sharePct.toFixed(2)}%
                    </td>
                    <td className={`px-4 py-2 text-right tabular-nums w-40 ${reversed ? 'line-through text-muted-foreground' : ''}`}>
                      {formatPKR(l.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      <p className="text-xs text-muted-foreground">
        Reopening posts a reversing entry that cancels the allocation and frees the period to be
        allocated again; both entries stay on the ledger. Deleting removes the record and its
        entries entirely.
      </p>
    </div>
  )
}
