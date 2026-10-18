// Pending invoices, invoice-wise — the Pending Receivables and Pending
// Payables reports and their Excel exports. Both sides share one shape; the
// settlement itself lives in lib/settlement/invoice-settlement.ts (also behind
// Receivables / Payables Aging, so the reports always agree).

import { createAdminClient } from '@/lib/supabase/admin'
import { loadInvoiceReceivables } from '@/lib/receivables/invoice-receivables'
import { loadInvoicePayables } from '@/lib/payables/invoice-payables'
import { openDocs, type SettledDoc } from '@/lib/settlement/invoice-settlement'
import { ageDays } from '@/lib/reports/aging'

export type PendingSide = 'receivable' | 'payable'

/** Wording and links per side. */
export const PENDING_SIDES = {
  receivable: {
    title:        'Pending Receivables — Invoice-wise',
    party:        'Customer',
    parties:      'Customers',
    applied:      'Received',
    returned:     'Returns / CN',
    ref:          'PO',
    searchHint:   'Voucher / PO no…',
    invoiceHref:  (id: string) => `/sales/invoice/${id}/report`,
    exportPath:   '/api/export/pending-receivables',
    filename:     'pending-receivables.xlsx',
    emptyText:    'No pending receivables — every invoice is settled.',
    appliedNote:  'receipt money applied to that invoice on the receipt form',
    poolNote:     'money not applied to any invoice — unapplied receipts, unlinked returns and credit notes',
  },
  payable: {
    title:        'Pending Payables — Invoice-wise',
    party:        'Supplier',
    parties:      'Suppliers',
    applied:      'Paid',
    returned:     'Returns / DN',
    ref:          'Bill',
    searchHint:   'Voucher / bill no…',
    invoiceHref:  (id: string) => `/purchases/invoice/${id}/report`,
    exportPath:   '/api/export/pending-payables',
    filename:     'pending-payables.xlsx',
    emptyText:    'No pending payables — every bill is paid.',
    appliedNote:  'payment money applied to that bill on the payment form',
    poolNote:     'money not applied to any bill — unapplied payments, customers who paid the supplier for us, unlinked returns and debit notes',
  },
} as const

export type PendingStatus = 'all' | 'overdue' | 'current'

export type PendingFilters = {
  partyId?: string
  status?: PendingStatus
  /** Matches voucher no. or the party's reference (PO / bill no.). */
  q?: string
}

export type PendingRow = SettledDoc & {
  /** Days since the invoice date. */
  age: number
  /** Days past the due date; null when there is no due date or it is not yet due. */
  overdueDays: number | null
  bucket: '0-30' | '31-60' | '61-90' | '90+'
}

export type PendingParty = {
  partyId: string
  partyName: string
  rows: PendingRow[]
  total: number
}

export type PendingTotals = {
  amount: number
  returned: number
  applied: number
  fifo: number
  balance: number
  overdue: number
  invoices: number
  parties: number
  buckets: Record<PendingRow['bucket'], number>
}

function bucketOf(age: number): PendingRow['bucket'] {
  if (age <= 30) return '0-30'
  if (age <= 60) return '31-60'
  if (age <= 90) return '61-90'
  return '90+'
}

export async function buildPendingInvoices(
  tenantId: string,
  side: PendingSide,
  filters: PendingFilters = {},
): Promise<{ parties: PendingParty[]; totals: PendingTotals }> {
  const admin = createAdminClient()
  const all = side === 'receivable'
    ? await loadInvoiceReceivables(admin, tenantId, { customerId: filters.partyId })
    : await loadInvoicePayables(admin, tenantId, { supplierId: filters.partyId })
  const needle = (filters.q ?? '').trim().toLowerCase()
  const status = filters.status ?? 'all'

  const parties: PendingParty[] = []
  for (const p of all) {
    const rows: PendingRow[] = openDocs(p)
      .map((d) => {
        const overdue = d.dueDate ? ageDays(d.dueDate) : null
        const age = ageDays(d.date)
        return { ...d, age, overdueDays: overdue !== null && overdue > 0 ? overdue : null, bucket: bucketOf(age) }
      })
      .filter((r) => status === 'all' || (status === 'overdue' ? r.overdueDays !== null : r.overdueDays === null))
      .filter((r) => !needle ||
        (r.serial ?? '').toLowerCase().includes(needle) ||
        (r.ref ?? '').toLowerCase().includes(needle))
    if (rows.length === 0) continue
    parties.push({ partyId: p.partyId, partyName: p.partyName, rows, total: rows.reduce((s, r) => s + r.balance, 0) })
  }
  parties.sort((a, b) => b.total - a.total)

  const totals: PendingTotals = {
    amount: 0, returned: 0, applied: 0, fifo: 0, balance: 0, overdue: 0, invoices: 0, parties: parties.length,
    buckets: { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 },
  }
  for (const r of parties.flatMap((p) => p.rows)) {
    totals.amount   += r.amount
    totals.returned += r.returned
    totals.applied  += r.applied
    totals.fifo     += r.fifo
    totals.balance  += r.balance
    if (r.overdueDays !== null) totals.overdue += r.balance
    if (!r.isOpening) totals.invoices += 1
    totals.buckets[r.bucket] += r.balance
  }

  return { parties, totals }
}

export function parsePendingFilters(params: Record<string, string | string[] | undefined>): PendingFilters {
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
  const status = str(params.status)
  return {
    partyId: str(params.party),
    status: status === 'overdue' || status === 'current' ? status : 'all',
    q: str(params.q)?.trim(),
  }
}
