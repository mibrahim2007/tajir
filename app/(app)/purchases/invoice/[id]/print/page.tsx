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

export default async function PrintPurchaseInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: invoiceId } = await params
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: lines }, tenant] = await Promise.all([
    admin.from('purchase_orders')
      .select('id, serial_number, date, created_at, quantity, rate, currency_code, exchange_rate, pkr_equivalent, advance_paid, supplier_id, stock_item_id, location_id')
      .eq('invoice_id', invoiceId)
      .eq('tenant_id', tenantId)
      .order('created_at'),
    getTenant(tenantId),
  ])

  if (!lines || lines.length === 0) notFound()

  const first = lines[0]
  const stockIds    = [...new Set(lines.map((l) => l.stock_item_id))]
  const supplierIds = [...new Set(lines.map((l) => l.supplier_id))]
  const locationIds = [...new Set(lines.map((l) => l.location_id).filter(Boolean) as string[])]

  const [{ data: stockItems }, { data: suppliers }, { data: locations }, { data: journalEntry }] = await Promise.all([
    admin.from('inventory_lots').select('id, name, unit_of_measure').in('id', stockIds),
    admin.from('suppliers').select('id, name').in('id', supplierIds),
    locationIds.length > 0
      ? admin.from('locations').select('id, name').in('id', locationIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    admin.from('tajir_journal_entries')
      .select('voucher_number')
      .eq('source_id', invoiceId)
      .eq('source_type', 'purchase_invoice')
      .single(),
  ])

  const stockMap    = new Map((stockItems ?? []).map((s) => [s.id, { name: s.name, uom: s.unit_of_measure ?? null }]))
  const supplierMap = new Map((suppliers ?? []).map((s) => [s.id, s.name]))
  const locationMap = new Map((locations ?? []).map((l) => [l.id, l.name]))

  const totalPKR    = lines.reduce((s, l) => s + l.pkr_equivalent, 0)
  const advancePaid = lines.reduce((s, l) => s + l.advance_paid, 0)
  const balanceDue  = totalPKR - advancePaid
  const er          = first.exchange_rate
  const isUSD       = first.currency_code === 'USD'
  const voucherNo   = journalEntry?.voucher_number ?? `PI-${invoiceId.slice(-6).toUpperCase()}`
  const entryTime   = formatPKTDateTime(new Date(first.created_at)).split(', ')[1]

  const supplierName  = supplierMap.get(first.supplier_id) ?? '—'
  const locationName  = first.location_id ? (locationMap.get(first.location_id) ?? null) : null

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden flex items-center gap-3 px-6 py-4 border-b bg-background sticky top-0">
        <Link href="/purchases">
          <Button variant="ghost" size="sm">← Back</Button>
        </Link>
        <span className="text-sm text-muted-foreground flex-1">Purchase Invoice · {voucherNo} · {lines.length} item{lines.length !== 1 ? 's' : ''}</span>
        <PrintButton />
      </div>

      <div className="max-w-2xl mx-auto px-8 py-10 print:px-4 print:py-6 print:max-w-none">

        {/* Header */}
        <div className="text-center mb-6 pb-4 border-b-2 border-black">
          <p className="text-xl font-extrabold tracking-wide uppercase">{tenant.name}</p>
          <p className="text-3xl font-bold tracking-widest uppercase mt-1">Purchase Invoice</p>
        </div>

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
            <span className="text-gray-500 w-28 shrink-0">Supplier</span>
            <span className="font-semibold">{supplierName}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-24 shrink-0">Entry Time</span>
            <span className="font-semibold">{entryTime}</span>
          </div>
          {locationName && (
            <div className="flex gap-2">
              <span className="text-gray-500 w-28 shrink-0">Received At</span>
              <span className="font-semibold">{locationName}</span>
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
              const qty    = line.quantity
              const rate   = line.rate
              const amount = line.pkr_equivalent
              return (
                <tr key={line.id} className={i % 2 === 1 ? 'bg-gray-50 print:bg-gray-50' : ''}>
                  <td className="px-3 py-2.5 border-r border-gray-200 text-gray-500 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2.5 border-r border-gray-200 font-medium">{stockMap.get(line.stock_item_id)?.name ?? '—'}</td>
                  <td className="px-3 py-2.5 border-r border-gray-200 text-right tabular-nums">{qty.toLocaleString(undefined, { maximumFractionDigits: 3 })}{stockMap.get(line.stock_item_id)?.uom ? <span className="ml-1 text-gray-500 text-xs">{stockMap.get(line.stock_item_id)!.uom}</span> : null}</td>
                  <td className="px-3 py-2.5 border-r border-gray-200 text-right tabular-nums whitespace-nowrap">{first.currency_code} {fmt(rate)}</td>
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

        {/* Totals summary */}
        <div className="flex justify-end mb-8">
          <table className="text-sm border border-gray-300">
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="px-5 py-2 text-gray-500 bg-gray-50 print:bg-gray-50 border-r border-gray-200 font-medium">Total Amount</td>
                <td className="px-5 py-2 text-right tabular-nums font-bold w-40">Rs {fmt(totalPKR)}</td>
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

        {/* Signatures */}
        <div className="flex justify-between mt-16 pt-4 text-sm text-center gap-4">
          <div className="flex-1"><div className="border-t border-black pt-2 text-gray-500">Accountant</div></div>
          <div className="flex-1"><div className="border-t border-black pt-2 text-gray-500">Supplier Representative</div></div>
          <div className="flex-1"><div className="border-t border-black pt-2 text-gray-500">Authorized By</div></div>
        </div>

      </div>
    </div>
  )
}
