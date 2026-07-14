'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

export type LoanListItem = {
  id: string
  employeeId: string
  employeeName: string
  serialNumber: string | null
  currencyCode: string
  principal: number
  disbursementDate: string
  installmentCount: number | null
  status: string
  outstanding: number
}

export function LoansList({ loans }: { loans: LoanListItem[] }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const filtered = useMemo(
    () => (q ? loans.filter((l) => l.employeeName.toLowerCase().includes(q) || (l.serialNumber ?? '').toLowerCase().includes(q)) : loans),
    [loans, q],
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          type="search"
          placeholder="Filter by employee or serial…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs min-h-[44px]"
        />
        {q && <p className="text-xs text-muted-foreground whitespace-nowrap">{filtered.length} of {loans.length}</p>}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-12 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No loans match &ldquo;{query}&rdquo;.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Serial</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Principal</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Outstanding (PKR)</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/employees/${l.employeeId}/ledger`} className="font-medium underline underline-offset-4 decoration-transparent hover:decoration-inherit">
                        {l.employeeName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{l.serialNumber ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(l.disbursementDate))}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {l.currencyCode !== 'PKR' ? `${l.currencyCode} ${l.principal.toLocaleString()}` : formatPKR(l.principal)}
                      {l.installmentCount ? <span className="text-muted-foreground text-xs ml-1">/ {l.installmentCount}mo</span> : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={l.outstanding > 0.01 ? 'text-amber-600 dark:text-amber-400' : l.outstanding < -0.01 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                        {formatPKR(Math.abs(l.outstanding))}{l.outstanding < -0.01 ? ' CR' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${l.status === 'closed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                        {l.status === 'closed' ? 'Settled' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
