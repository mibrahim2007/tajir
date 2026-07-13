'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { formatPKR } from '@/lib/utils/currency'

export type EmployeeListItem = {
  id: string
  name: string
  designation: string | null
  isActive: boolean
  outstanding: number
}

export function EmployeesList({ employees }: { employees: EmployeeListItem[] }) {
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () => (q ? employees.filter((e) => e.name.toLowerCase().includes(q)) : employees),
    [employees, q],
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          type="search"
          placeholder="Filter by employee name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs min-h-[44px]"
        />
        {q && (
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            {filtered.length} of {employees.length}
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-12 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No employees match &ldquo;{query}&rdquo;.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Loan Outstanding (PKR)</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium">{e.name}</span>
                    {e.designation && <span className="text-muted-foreground text-xs ml-2">{e.designation}</span>}
                    {!e.isActive && <span className="text-xs ml-2 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {e.outstanding < 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Credit</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">{formatPKR(Math.abs(e.outstanding))}</span>
                      </span>
                    ) : (
                      <span className={e.outstanding > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
                        {formatPKR(e.outstanding)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/employees/${e.id}/ledger`}
                      className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
                    >
                      Ledger
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
