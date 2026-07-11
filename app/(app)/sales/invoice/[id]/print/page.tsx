import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenant } from '@/lib/auth/get-tenant'
import { PrintVoucherHeader } from '@/components/print-voucher-header'
import { Button } from '@/components/ui/button'
import { PrintButton } from './print-button'
import { formatPKTDate, formatPKTDateTime } from '@/lib/utils/dates'

function fmt(n: number) {
  return n.toLocaleString('en-PK', { maximumFractionDigits: 2 })
}

export default async function PrintSaleInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: invoiceId } = await params
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: lines }, tenant] = await Promise.all([
    admin.from('sales_orders')
      .select('id, serial_number, date, created_at, quantity, rate, currency_code, exchange_rate, pkr_equivalent, payment_due_date, customer_id, stock_item_id, notes')
      .eq('invoice_id', invoiceId)
      .eq('tenant_id', tenantId)
      .order('created_at'),
    getTenant(tenantId),
  ])

  if (!lines || lines.length === 0) notFound()

  const first = lines[0]
  const stockIds    = [...new Set(lines.map((l) => l.stock_item_id))]
  const customerIds = [...new Set(lines.map((l) => l.customer_id))]

  const [{ data: stockItems }, { data: customers }, { data: journalEntry }, { data: rawPurchases }] = await Promise.all([
    admin.from('inventory_lots').select('id, name, unit_of_measure').in('id', stockIds),
    admin.from('tajir_customers').select('id, name').in('id', customerIds),
    admin.from('tajir_journal_entries')
      .select('voucher_number')
      .eq('source_id', invoiceId)
      .eq('source_type', 'sale_invoice')
      .single(),
    admin.from('purchase_orders')
      .select('stock_item_id, pkr_equivalent, quantity')
      .eq('tenant_id', tenantId)
      .in('stock_item_id', stockIds)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  const stockMap    = new Map((stockItems ?? []).map((s) => [s.id, { name: s.name, uom: s.unit_of_measure ?? null }]))
  const customerMap = new Map((customers ?? []).map((c) => [c.id, c.name]))

  // Latest cost per stock item
  const costMap: Record<string, number> = {}
  for (const p of rawPurchases ?? []) {
    if (!costMap[p.stock_item_id])
      costMap[p.stock_item_id] = p.pkr_equivalent / p.quantity
  }

  const totalPKR   = lines.reduce((s, l) => s + l.pkr_equivalent, 0)
  const er         = first.exchange_rate
  const isUSD      = first.currency_code === 'USD'
  const voucherNo  = journalEntry?.voucher_number ?? `SI-${invoiceId.slice(-6).toUpperCase()}`
  const entryTime  = formatPKTDateTime(new Date(first.created_at)).split(', ')[1]
  const customerName = customerMap.get(first.customer_id) ?? '—'
  const notes = lines.find((l) => l.notes && l.notes.trim())?.notes?.trim() ?? null

  return (
    <div className="min-h-screen bg-white">
      {/* Keep the invoice on a single printed page */}
      <style>{`@media print { @page { size: A4; margin: 12mm } html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact } }`}</style>
      <div className="print:hidden flex items-center gap-3 px-6 py-4 border-b bg-background sticky top-0">
        <Link href="/sales">
          <Button variant="ghost" size="sm">← Back</Button>
        </Link>
        <span className="text-sm text-muted-foreground flex-1">Sale Invoice · {voucherNo} · {lines.length} item{lines.length !== 1 ? 's' : ''}</span>
        <PrintButton />
      </div>

      <div className="max-w-2xl mx-auto px-8 py-10 print:px-4 print:py-6 print:max-w-none">

        {/* Header */}
        <PrintVoucherHeader name={tenant.name} ntn={tenant.ntn} title="Sale Invoice" />

        {/* Meta */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6">
          <div className="flex gap-2">
            <span className="text-gray-500 w-28 shrink-0">Serial No.</span>
            <span className="font-mono font-bold">{first.serial_number ?? '—'}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-24 shrink-0">Date</span>
            <span className="font-semibold">{formatPKTDate(new Date(first.date))}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-28 shrink-0">Voucher No.</span>
            <span className="font-mono font-bold">{voucherNo}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-28 shrink-0">Customer</span>
            <span className="font-semibold">{customerName}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-24 shrink-0">Entry Time</span>
            <span className="font-semibold">{entryTime}</span>
          </div>
          {first.payment_due_date && (
            <div className="flex gap-2">
              <span className="text-gray-500 w-28 shrink-0">Payment Due</span>
              <span className="font-semibold">{formatPKTDate(new Date(first.payment_due_date))}</span>
            </div>
          )}
          {isUSD && (
            <div className="flex gap-2">
              <span className="text-gray-500 w-24 shrink-0">Exchange Rate</span>
              <span className="font-semibold">1 USD = Rs {fmt(er)}</span>
            </div>
          )}
        </div>

        {/* Line items */}
        <table className="w-full text-sm mb-6 border border-gray-300">
          <thead className="bg-gray-100 print:bg-gray-100">
            <tr>
              <th className="text-left px-3 py-2 border-b border-r border-gray-300 font-semibold text-[11px] uppercase tracking-wide w-8">#</th>
              <th className="text-left px-3 py-2 border-b border-r border-gray-300 font-semibold text-[11px] uppercase tracking-wide">Stock Item</th>
              <th className="text-right px-3 py-2 border-b border-r border-gray-300 font-semibold text-[11px] uppercase tracking-wide w-24">Qty</th>
              <th className="text-right px-3 py-2 border-b border-r border-gray-300 font-semibold text-[11px] uppercase tracking-wide w-32">Rate</th>
              <th className="text-right px-3 py-2 border-b border-gray-300 font-semibold text-[11px] uppercase tracking-wide w-36">Amount (PKR)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const qty      = line.quantity
              const rate     = line.rate
              const amount   = line.pkr_equivalent
              const cost     = costMap[line.stock_item_id]
              const ratePKR  = rate * er
              const belowCost = cost !== undefined && ratePKR < cost
              return (
                <tr key={line.id} className={i % 2 === 1 ? 'bg-gray-50 print:bg-gray-50' : ''}>
                  <td className="px-3 py-2.5 border-r border-gray-200 text-gray-500 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2.5 border-r border-gray-200 font-medium">{stockMap.get(line.stock_item_id)?.name ?? '—'}</td>
                  <td className="px-3 py-2.5 border-r border-gray-200 text-right tabular-nums">{qty.toLocaleString(undefined, { maximumFractionDigits: 3 })}{stockMap.get(line.stock_item_id)?.uom ? <span className="ml-1 text-gray-500 text-xs">{stockMap.get(line.stock_item_id)!.uom}</span> : null}</td>
                  <td className="px-3 py-2.5 border-r border-gray-200 text-right tabular-nums whitespace-nowrap">
                    {first.currency_code} {fmt(rate)}
                    {belowCost && cost && (
                      <span className="block text-[10px] text-amber-600 print:text-amber-700">⚠ Below cost (Rs {fmt(cost)})</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold">Rs {fmt(amount)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t-2 border-gray-300 bg-gray-100 print:bg-gray-100">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right font-semibold text-[11px] uppercase tracking-wide border-r border-gray-300">Total</td>
              <td className="px-3 py-2 text-right font-extrabold tabular-nums">Rs {fmt(totalPKR)}</td>
            </tr>
          </tfoot>
        </table>

        {first.payment_due_date && (
          <div className="text-sm text-gray-500 mb-4">
            Payment due by <span className="font-semibold text-gray-700">{formatPKTDate(new Date(first.payment_due_date))}</span>
          </div>
        )}

        {/* Notes */}
        {notes && (
          <div className="text-sm mb-8 print:mb-6">
            <p className="text-gray-500 font-semibold text-[11px] uppercase tracking-wide mb-1">Notes</p>
            <p className="whitespace-pre-wrap text-gray-700 border border-gray-200 rounded px-3 py-2">{notes}</p>
          </div>
        )}

        {/* Signatures */}
        <div className="flex justify-between mt-16 print:mt-10 pt-4 text-sm text-center gap-4">
          <div className="flex-1"><div className="border-t border-black pt-2 text-gray-500">Accountant</div></div>
          <div className="flex-1"><div className="border-t border-black pt-2 text-gray-500">Customer Representative</div></div>
          <div className="flex-1"><div className="border-t border-black pt-2 text-gray-500">Authorized By</div></div>
        </div>

      </div>
    </div>
  )
}
