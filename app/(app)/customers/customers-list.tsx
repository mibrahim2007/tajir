'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EditCustomerForm } from './edit-customer-form'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deleteCustomerAction } from '@/app/actions/delete-customer'
import { formatPKR } from '@/lib/utils/currency'
import { CUSTOMER_STATUSES, CUSTOMER_STATUS_LABELS, CUSTOMER_STATUS_BADGE, toCustomerStatus } from '@/lib/customer-status'

export type CustomerListItem = {
  id: string
  name: string
  status?: string
  outstanding: number
}

export function CustomersList({ customers }: { customers: CustomerListItem[] }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all')

  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () => customers.filter((c) =>
      (!q || c.name.toLowerCase().includes(q)) &&
      (statusFilter === 'all' || toCustomerStatus(c.status) === statusFilter),
    ),
    [customers, q, statusFilter],
  )

  const showingCount = q || statusFilter !== 'all'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="search"
            placeholder="Filter by customer name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xs min-h-[44px]"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="min-h-[44px] w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {CUSTOMER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{CUSTOMER_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {showingCount && (
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            {filtered.length} of {customers.length}
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-12 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No customers match your filters.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Outstanding (PKR)</th>
                  <th className="px-4 py-3" />
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((c) => {
                  const st = toCustomerStatus(c.status)
                  return (
                    <tr key={c.id} className="hover:bg-secondary/50 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CUSTOMER_STATUS_BADGE[st]}`}>
                          {CUSTOMER_STATUS_LABELS[st]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {c.outstanding < 0 ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Credit</span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">{formatPKR(Math.abs(c.outstanding))}</span>
                          </span>
                        ) : (
                          <span className={c.outstanding > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
                            {formatPKR(c.outstanding)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/customers/${c.id}/ledger`}
                          className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
                        >
                          Ledger
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <RoleGate allowedRoles={['owner']}>
                          <div className="flex gap-1 justify-end">
                            <EditCustomerForm id={c.id} currentName={c.name} currentStatus={c.status} />
                            <DeleteButton
                              description={`Delete customer "${c.name}"? All associated sales and receipts will also be deleted.`}
                              onDelete={deleteCustomerAction.bind(null, { id: c.id })}
                            />
                          </div>
                        </RoleGate>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
