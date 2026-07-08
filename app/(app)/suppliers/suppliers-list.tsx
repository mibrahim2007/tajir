'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { EditSupplierForm } from './edit-supplier-form'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deleteSupplierAction } from '@/app/actions/delete-supplier'
import { formatPKR } from '@/lib/utils/currency'

export type SupplierListItem = {
  id: string
  name: string
  outstanding: number
}

export function SuppliersList({ suppliers }: { suppliers: SupplierListItem[] }) {
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () => (q ? suppliers.filter((s) => s.name.toLowerCase().includes(q)) : suppliers),
    [suppliers, q],
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          type="search"
          placeholder="Filter by supplier name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs min-h-[44px]"
        />
        {q && (
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            {filtered.length} of {suppliers.length}
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-12 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No suppliers match &ldquo;{query}&rdquo;.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Outstanding (PKR)</th>
                <th className="px-4 py-3" />
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${s.outstanding > 0 ? 'text-destructive' : s.outstanding < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {formatPKR(Math.abs(s.outstanding))}
                    {s.outstanding < 0 && <span className="ml-1 text-xs opacity-70">CR</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/suppliers/${s.id}/ledger`}
                      className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
                    >
                      Ledger
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <RoleGate allowedRoles={['owner']}>
                      <div className="flex gap-1 justify-end">
                        <EditSupplierForm id={s.id} currentName={s.name} />
                        <DeleteButton
                          description={`Delete supplier "${s.name}"? This cannot be undone.`}
                          onDelete={deleteSupplierAction.bind(null, { id: s.id })}
                        />
                      </div>
                    </RoleGate>
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
