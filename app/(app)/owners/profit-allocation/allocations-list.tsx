'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatPKR } from '@/lib/utils/currency'
import { deleteProfitAllocationAction } from '@/app/actions/delete-profit-allocation'

export type AllocationItem = {
  id: string
  serialNumber: string | null
  periodStart: string
  periodEnd: string
  periodLabel: string
  netProfit: number
  notes: string | null
  lines: { ownerId: string; name: string; sharePct: number; amount: number }[]
}

export function AllocationsList({ allocations }: { allocations: AllocationItem[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [armedId, setArmedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onDelete = (id: string) => {
    if (armedId !== id) { setArmedId(id); setError(null); return }
    startTransition(async () => {
      setError(null)
      const result = await deleteProfitAllocationAction({ id })
      setArmedId(null)
      if (!result.success) { setError(result.error); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {allocations.map((a) => {
        const isProfit = a.netProfit > 0
        return (
          <div key={a.id} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30">
              <div>
                <p className="font-medium">{a.periodLabel}</p>
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
                  <p className={`tabular-nums font-semibold ${isProfit ? '' : 'text-destructive'}`}>
                    {formatPKR(Math.abs(a.netProfit))}
                  </p>
                </div>
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
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {a.lines.map((l) => (
                  <tr key={l.ownerId}>
                    <td className="px-4 py-2">{l.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground w-24">
                      {l.sharePct.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums w-40">{formatPKR(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      <p className="text-xs text-muted-foreground">
        Deleting an allocation also reverses its journal entry and frees the period for re-allocation.
      </p>
    </div>
  )
}
