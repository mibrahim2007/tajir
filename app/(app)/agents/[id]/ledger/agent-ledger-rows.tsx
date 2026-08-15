'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatPKR } from '@/lib/utils/currency'
import { deleteAgentPaymentAction } from '@/app/actions/delete-agent-payment'
import type { AgentLedgerRow } from '@/lib/agents/ledger'

const KIND_BADGE: Record<AgentLedgerRow['kind'], { label: string; className: string }> = {
  opening: {
    label: 'Opening',
    className: 'bg-muted text-muted-foreground',
  },
  commission: {
    label: 'Commission',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  },
  clawback: {
    label: 'Reversal',
    className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
  },
  payment: {
    label: 'Payment',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  },
}

export function AgentLedgerRows({ rows }: { rows: AgentLedgerRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Two-click confirm: the first click arms the row, the second deletes. Avoids
  // a blocking browser dialog while still guarding an irreversible GL reversal.
  const [armedId, setArmedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onDelete = (id: string) => {
    if (armedId !== id) { setArmedId(id); setError(null); return }
    startTransition(async () => {
      setError(null)
      const result = await deleteAgentPaymentAction({ id })
      setArmedId(null)
      if (!result.success) { setError(result.error); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Reference</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Detail</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Earned</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Paid</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Balance</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const badge = KIND_BADGE[r.kind]
              return (
                <tr key={r.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">{r.dateLabel}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.reference ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${badge.className}`}>
                      {badge.label}
                    </span>
                    <span className="ml-2">{r.description}</span>
                    {r.basis && <p className="text-xs text-muted-foreground mt-0.5">{r.basis}</p>}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${
                    r.earned < 0 ? 'text-rose-700 dark:text-rose-400' : ''
                  }`}>
                    {r.earned !== 0 ? formatPKR(r.earned) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                    {r.paid !== 0 ? formatPKR(r.paid) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatPKR(r.balance)}</td>
                  <td className="px-4 py-3 text-right">
                    {r.deletable ? (
                      <button
                        type="button"
                        onClick={() => onDelete(r.id)}
                        onBlur={() => armedId === r.id && setArmedId(null)}
                        disabled={isPending}
                        className={`text-xs underline underline-offset-4 disabled:opacity-50 ${
                          armedId === r.id ? 'text-destructive font-semibold' : 'text-muted-foreground hover:text-destructive'
                        }`}
                      >
                        {armedId === r.id ? 'Confirm?' : 'Delete'}
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Commission rows follow their invoice — edit or delete the invoice to change them.
        Deleting a payment also reverses its journal entry.
      </p>
    </div>
  )
}
