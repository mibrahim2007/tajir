import { Suspense } from 'react'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { PrintButton } from '@/components/print-button'
import { PurchaseDetailFilters } from './purchase-detail-filters'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function parseDate(val: unknown, fallback: string): string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val : fallback
}

export default async function PurchaseDetailReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { tenantId } = await requireAuth()
  const params = await searchParams

  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 7) + '-01'

  const from     = parseDate(params.from, firstOfMonth)
  const to       = parseDate(params.to, today)
  const supplier = typeof params.supplier === 'string' ? params.supplier : undefined
  const q        = typeof params.q === 'string' ? params.q.trim() : ''

  const admin = createAdminClient()

  let linesQuery = admin.from('purchase_orders')
    .select('id, invoice_id, serial_number, supplier_invoice_no, supplier_id, date, quantity, pkr_equivalent, advance_paid, stock_item_id')
    .eq('tenant_id', tenantId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })
  if (supplier) linesQuery = linesQuery.eq('supplier_id', supplier)

  const [{ data: rawLines }, { data: rawSuppliers }] = await Promise.all([
    linesQuery,
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name'),
  ])

  const supplierList = rawSuppliers ?? []
  const supplierMap  = new Map(supplierList.map((s) => [s.id, s.name]))

  // An invoice has no header table — it's the set of purchase_orders rows sharing
  // an invoice_id, all carrying the same serial and supplier invoice number.
  // Legacy rows predate invoice_id, so each stands alone as its own invoice.
  type Invoice = {
    key: string
    invoiceId: string | null
    date: string
    serial: string | null
    supplierInvoiceNo: string | null
    supplierName: string
    itemCount: number
    amount: number
    advance: number
  }

  const byInvoice = new Map<string, Invoice>()
  for (const l of rawLines ?? []) {
    const key = l.invoice_id ?? l.id
    const existing = byInvoice.get(key)
    if (existing) {
      existing.itemCount += 1
      existing.amount    += l.pkr_equivalent ?? 0
      existing.advance   += l.advance_paid ?? 0
      continue
    }
    byInvoice.set(key, {
      key,
      invoiceId:         l.invoice_id,
      date:              l.date,
      serial:            l.serial_number,
      supplierInvoiceNo: l.supplier_invoice_no,
      supplierName:      supplierMap.get(l.supplier_id) ?? '—',
      itemCount:         1,
      amount:            l.pkr_equivalent ?? 0,
      advance:           l.advance_paid ?? 0,
    })
  }

  // Match on either number. Filtered here rather than in SQL because the search
  // spans two columns and the date range already bounds the row count.
  const needle = q.toLowerCase()
  const invoices = [...byInvoice.values()]
    .filter((inv) => !needle ||
      (inv.supplierInvoiceNo ?? '').toLowerCase().includes(needle) ||
      (inv.serial ?? '').toLowerCase().includes(needle))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.serial ?? '').localeCompare(a.serial ?? ''))

  const totalAmount  = invoices.reduce((s, i) => s + i.amount, 0)
  const totalAdvance = invoices.reduce((s, i) => s + i.advance, 0)

  const dateLabel = `${formatPKTDate(from + 'T00:00:00')} – ${formatPKTDate(to + 'T00:00:00')}`

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 print:mb-2">
        <div>
          <h1 className="text-2xl font-semibold">Purchase Detail</h1>
          <p className="text-sm text-muted-foreground mt-1 print:block">
            {dateLabel}
            {supplier && ` · ${supplierMap.get(supplier) ?? 'Unknown supplier'}`}
            {q && ` · “${q}”`}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton />
        </div>
      </div>

      {/* ── Filters ── */}
      <Suspense>
        <PurchaseDetailFilters suppliers={supplierList} />
      </Suspense>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Purchases</p>
          <p className="text-xl font-semibold tabular-nums">{formatPKR(totalAmount)}</p>
          <p className="text-xs text-muted-foreground mt-1">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-1">Advance Paid</p>
          <p className="text-xl font-semibold tabular-nums">{formatPKR(totalAdvance)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-1">Balance</p>
          <p className="text-xl font-semibold tabular-nums">{formatPKR(totalAmount - totalAdvance)}</p>
          <p className="text-xs text-muted-foreground mt-1">Purchases − advance</p>
        </div>
      </div>

      {/* ── Table ── */}
      {invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">
            {q || supplier ? 'No purchase invoices match these filters.' : 'No purchase invoices in this date range.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Voucher No</th>
                  <th className="text-left px-4 py-3 font-medium">Supplier Invoice No</th>
                  <th className="text-left px-4 py-3 font-medium">Supplier</th>
                  <th className="text-right px-4 py-3 font-medium">Items</th>
                  <th className="text-right px-4 py-3 font-medium">Advance</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv) => (
                  <tr key={inv.key} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatPKTDate(inv.date + 'T00:00:00')}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {inv.invoiceId ? (
                        <Link href={`/purchases/invoice/${inv.invoiceId}/report`} className="text-primary hover:underline print:no-underline print:text-foreground">
                          {inv.serial ?? '—'}
                        </Link>
                      ) : (inv.serial ?? '—')}
                    </td>
                    <td className="px-4 py-2.5">
                      {inv.supplierInvoiceNo || <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-4 py-2.5">{inv.supplierName}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{inv.itemCount}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {inv.advance > 0 ? formatPKR(inv.advance) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatPKR(inv.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30">
                <tr>
                  <td colSpan={5} className="px-4 py-3 font-medium text-right">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatPKR(totalAdvance)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatPKR(totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Print-only footer ── */}
      <div className="hidden print:block mt-8 pt-4 border-t text-xs text-muted-foreground text-center">
        Generated {formatPKTDate(new Date().toISOString())} · {dateLabel}
      </div>
    </div>
  )
}
