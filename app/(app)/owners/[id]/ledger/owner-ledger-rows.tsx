'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatPKR } from '@/lib/utils/currency'
import { deleteOwnerTransactionAction } from '@/app/actions/delete-owner-transaction'

export type OwnerLedgerRow = {
  id: string
  serialNumber: string | null
  date: string
  dateLabel: string
  txnType: 'withdrawal' | 'contribution'
  contributed: number
  drawn: number
  balance: number
  currencyCode: string
  amount: number
  notes: string | null
}

export function OwnerLedgerRows({ rows }: { rows: OwnerLedgerRow[] }) {
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
      const result = await deleteOwnerTransactionAction({ id })
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
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Serial</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Type</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Capital In</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Drawings</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Balance</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-secondary/50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap">{r.dateLabel}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.serialNumber ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                    r.txnType === 'contribution'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                  }`}>
                    {r.txnType === 'contribution' ? 'Contribution' : 'Withdrawal'}
                  </span>
                  {r.currencyCode !== 'PKR' && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {r.currencyCode} {r.amount.toLocaleString()}
                    </span>
                  )}
                  {r.notes && <span className="text-xs text-muted-foreground ml-2">{r.notes}</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.contributed > 0 ? formatPKR(r.contributed) : '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">
                  {r.drawn > 0 ? formatPKR(r.drawn) : '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{formatPKR(r.balance)}</td>
                <td className="px-4 py-3 text-right">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Deleting a movement also reverses its journal entry.
      </p>
    </div>
  )
}
