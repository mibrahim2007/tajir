// Pending Receivables — invoice-wise. Shared by the report page and its Excel
// export so the two cannot disagree. The settlement itself lives in
// lib/receivables/invoice-receivables.ts (also behind Receivables Aging).

import { createAdminClient } from '@/lib/supabase/admin'
import { loadInvoiceReceivables, openDocs, type ReceivableDoc } from '@/lib/receivables/invoice-receivables'
import { ageDays } from '@/lib/reports/aging'

export type PendingStatus = 'all' | 'overdue' | 'current'

export type PendingFilters = {
  customerId?: string
  status?: PendingStatus
  /** Matches voucher no. or PO no. */
  q?: string
}

export type PendingRow = ReceivableDoc & {
  /** Days since the invoice date. */
  age: number
  /** Days past the due date; null when there is no due date or it is not yet due. */
  overdueDays: number | null
  bucket: '0-30' | '31-60' | '61-90' | '90+'
}

export type PendingCustomer = {
  customerId: string
  customerName: string
  rows: PendingRow[]
  total: number
}

export type PendingTotals = {
  amount: number
  returned: number
  received: number
  fifo: number
  balance: number
  overdue: number
  invoices: number
  customers: number
  buckets: Record<PendingRow['bucket'], number>
}

function bucketOf(age: number): PendingRow['bucket'] {
  if (age <= 30) return '0-30'
  if (age <= 60) return '31-60'
  if (age <= 90) return '61-90'
  return '90+'
}

export async function buildPendingReceivables(tenantId: string, filters: PendingFilters = {}): Promise<{ customers: PendingCustomer[]; totals: PendingTotals }> {
  const admin = createAdminClient()
  const all = await loadInvoiceReceivables(admin, tenantId, { customerId: filters.customerId })
  const needle = (filters.q ?? '').trim().toLowerCase()
  const status = filters.status ?? 'all'

  const customers: PendingCustomer[] = []
  for (const c of all) {
    const rows: PendingRow[] = openDocs(c)
      .map((d) => {
        const overdue = d.dueDate ? ageDays(d.dueDate) : null
        const age = ageDays(d.date)
        return { ...d, age, overdueDays: overdue !== null && overdue > 0 ? overdue : null, bucket: bucketOf(age) }
      })
      .filter((r) => status === 'all' || (status === 'overdue' ? r.overdueDays !== null : r.overdueDays === null))
      .filter((r) => !needle ||
        (r.serial ?? '').toLowerCase().includes(needle) ||
        (r.poNo ?? '').toLowerCase().includes(needle))
    if (rows.length === 0) continue
    customers.push({ customerId: c.customerId, customerName: c.customerName, rows, total: rows.reduce((s, r) => s + r.balance, 0) })
  }
  customers.sort((a, b) => b.total - a.total)

  const totals: PendingTotals = {
    amount: 0, returned: 0, received: 0, fifo: 0, balance: 0, overdue: 0, invoices: 0, customers: customers.length,
    buckets: { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 },
  }
  for (const r of customers.flatMap((c) => c.rows)) {
    totals.amount   += r.amount
    totals.returned += r.returned
    totals.received += r.received
    totals.fifo     += r.fifo
    totals.balance  += r.balance
    if (r.overdueDays !== null) totals.overdue += r.balance
    if (!r.isOpening) totals.invoices += 1
    totals.buckets[r.bucket] += r.balance
  }

  return { customers, totals }
}

export function parsePendingFilters(params: Record<string, string | string[] | undefined>): PendingFilters {
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
  const status = str(params.status)
  return {
    customerId: str(params.customer),
    status: status === 'overdue' || status === 'current' ? status : 'all',
    q: str(params.q)?.trim(),
  }
}
