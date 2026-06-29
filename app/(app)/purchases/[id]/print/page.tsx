import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenant } from '@/lib/auth/get-tenant'
import { Button } from '@/components/ui/button'
import { PrintButton } from './print-button'
import { formatPKTDate, formatPKTDateTime } from '@/lib/utils/dates'

function fmt(n: number) {
  return n.toLocaleString('en-PK', { maximumFractionDigits: 2 })
}

export default async function PrintPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: order }, tenant] = await Promise.all([
    admin.from('purchase_orders')
      .select('id, date, created_at, quantity, rate, currency_code, exchange_rate, pkr_equivalent, advance_paid, supplier_id, stock_item_id, location_id')
      .eq('id', id).eq('tenant_id', tenantId).single(),
    getTenant(tenantId),
  ])

  if (!order) notFound()

  const [
    { data: supplier },
    { data: stockItem },
    { data: location },
    { data: journalEntry },
  ] = await Promise.all([
    admin.from('suppliers').select('id, name').eq('id', order.supplier_id).single(),
    admin.from('inventory_lots').select('id, name').eq('id', order.stock_item_id).single(),
    order.location_id
      ? admin.from('locations').select('id, name').eq('id', order.location_id).single()
      : Promise.resolve({ data: null }),
    admin.from('tajir_journal_entries')
      .select('voucher_number')
      .eq('source_id', id)
      .eq('source_type', 'purchase_order')
      .single(),
  ])

  const qty         = parseFloat(order.quantity)
  const rate        = parseFloat(order.rate)
  const pkrTotal    = parseFloat(order.pkr_equivalent)
  const advancePaid = parseFloat(order.advance_paid ?? '0')
  const balanceDue  = pkrTotal - advancePaid
  const er          = parseFloat(order.exchange_rate)
  const isUSD       = order.currency_code === 'USD'
  const voucherNo   = journalEntry?.voucher_number ?? `PO-${id.slice(-6).toUpperCase()}`
  const entryTime   = formatPKTDateTime(new Date(order.created_at)).split(', ')[1]

  return (
    <div className="min-h-screen bg-white">
      {/* Screen toolbar — hidden on print */}
      <div className="print:hidden flex items-center gap-3 px-6 py-4 border-b bg-background sticky top-0">
        <Link href="/purchases">
          <Button variant="ghost" size="sm">← Back</Button>
        </Link>
        <span className="text-sm text-muted-foreground flex-1">Purchase Voucher · {voucherNo}</span>
        <PrintButton />
      </div>

      {/* ── REPORT BODY ── */}
      <div className="max-w-2xl mx-auto px-8 py-10 print:px-4 print:py-6 print:max-w-none">

        {/* Header */}
        <div className="text-center mb-6 pb-4 border-b-2 border-black">
          <p className="text-xl font-extrabold tracking-wide uppercase">{tenant.name}</p>
          <p className="text-3xl font-bold tracking-widest uppercase mt-1">Purchase Voucher</p>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6">
          <div className="flex gap-2">
            <span className="text-gray-500 w-28 shrink-0">Voucher No.</span>
            <span className="font-mono font-bold">{voucherNo}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-24 shrink-0">Date</span>
            <span className="font-semibold">{formatPKTDate(new Date(order.date))}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-28 shrink-0">Supplier</span>
            <span className="font-semibold">{supplier?.name ?? '—'}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-24 shrink-0">Entry Time</span>
            <span className="font-semibold">{entryTime}</span>
          </div>
          {location && (
            <div className="flex gap-2">
              <span className="text-gray-500 w-28 shrink-0">Received At</span>
              <span className="font-semibold">{location.name}</span>
            </div>
          )}
          {isUSD && (
            <div className="flex gap-2">
              <span className="text-gray-500 w-24 shrink-0">Exchange Rate</span>
              <span className="font-semibold">1 USD = Rs {fmt(er)}</span>
            </div>
          )}
        </div>

        {/* Line items table */}
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
            <tr>
              <td className="px-3 py-3 border-r border-gray-200 text-gray-500 tabular-nums">1</td>
              <td className="px-3 py-3 border-r border-gray-200 font-medium">{stockItem?.name ?? '—'}</td>
              <td className="px-3 py-3 border-r border-gray-200 text-right tabular-nums">{qty.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
              <td className="px-3 py-3 border-r border-gray-200 text-right tabular-nums whitespace-nowrap">
                {order.currency_code} {fmt(rate)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums font-semibold">Rs {fmt(pkrTotal)}</td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <table className="text-sm border border-gray-300">
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="px-5 py-2 text-gray-500 bg-gray-50 print:bg-gray-50 border-r border-gray-200 font-medium">Total Amount</td>
                <td className="px-5 py-2 text-right tabular-nums font-bold w-40">Rs {fmt(pkrTotal)}</td>
              </tr>
              {advancePaid > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="px-5 py-2 text-gray-500 bg-gray-50 print:bg-gray-50 border-r border-gray-200 font-medium">Advance Paid</td>
                  <td className="px-5 py-2 text-right tabular-nums text-green-700 w-40">Rs {fmt(advancePaid)}</td>
                </tr>
              )}
              <tr className="bg-gray-100 print:bg-gray-100">
                <td className="px-5 py-2.5 font-bold border-r border-gray-200">Balance Due</td>
                <td className="px-5 py-2.5 text-right tabular-nums font-extrabold text-lg w-40">Rs {fmt(balanceDue)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Signature section */}
        <div className="flex justify-between mt-16 pt-4 text-sm text-center gap-4">
          <div className="flex-1">
            <div className="border-t border-black pt-2 text-gray-500">Accountant</div>
          </div>
          <div className="flex-1">
            <div className="border-t border-black pt-2 text-gray-500">Supplier Representative</div>
          </div>
          <div className="flex-1">
            <div className="border-t border-black pt-2 text-gray-500">Authorized By</div>
          </div>
        </div>

      </div>
    </div>
  )
}
