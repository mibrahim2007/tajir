'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { formatPKR } from '@/lib/utils/currency'

export type OwnerListItem = {
  id: string
  name: string
  cnic: string | null
  profitSharePct: number
  isActive: boolean
  contributed: number
  drawn: number
  net: number
}

export function OwnersList({ owners }: { owners: OwnerListItem[] }) {
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () => (q ? owners.filter((o) => o.name.toLowerCase().includes(q)) : owners),
    [owners, q],
  )

  const totals = filtered.reduce(
    (acc, o) => ({
      contributed: acc.contributed + o.contributed,
      drawn: acc.drawn + o.drawn,
      net: acc.net + o.net,
    }),
    { contributed: 0, drawn: 0, net: 0 },
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          type="search"
          placeholder="Filter by owner name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs min-h-[44px]"
        />
        {q && (
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            {filtered.length} of {owners.length}
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-12 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No owners match &ldquo;{query}&rdquo;.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Owner</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Share</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Capital In</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Drawings</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Net Capital</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium">{o.name}</span>
                    {o.cnic && <span className="text-muted-foreground text-xs ml-2">{o.cnic}</span>}
                    {!o.isActive && <span className="text-xs ml-2 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {o.profitSharePct > 0 ? `${o.profitSharePct.toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPKR(o.contributed)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">
                    {formatPKR(o.drawn)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {o.net < 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">Overdrawn</span>
                        <span className="text-amber-700 dark:text-amber-400 font-medium">{formatPKR(Math.abs(o.net))}</span>
                      </span>
                    ) : (
                      <span className="font-medium">{formatPKR(o.net)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/owners/${o.id}/ledger`}
                      className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
                    >
                      Ledger
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 1 && (
              <tfoot className="border-t bg-muted/30">
                <tr className="font-medium">
                  <td className="px-4 py-3" colSpan={2}>Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPKR(totals.contributed)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPKR(totals.drawn)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPKR(totals.net)}</td>
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
