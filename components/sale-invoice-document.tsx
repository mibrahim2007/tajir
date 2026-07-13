import { PrintVoucherHeader } from '@/components/print-voucher-header'
import { formatPKTDate } from '@/lib/utils/dates'
import type { SaleInvoiceData } from '@/lib/sales/load-sale-invoice'

function fmt(n: number) {
  return n.toLocaleString('en-PK', { maximumFractionDigits: 2 })
}

/**
 * Presentational sale-invoice body, shared by the internal print page and the
 * public share page. Pure — all data comes from `loadSaleInvoice`.
 *
 * `showCostWarnings` reveals below-cost margin flags. NEVER pass true on the
 * customer-facing (public) page.
 */
export function SaleInvoiceDocument({
  invoice,
  showCostWarnings = false,
}: {
  invoice: SaleInvoiceData
  showCostWarnings?: boolean
}) {
  const { tenant, lines, currencyCode, exchangeRate: er, isUSD, totalPKR, notes } = invoice

  return (
    <div className="max-w-2xl mx-auto px-8 py-10 print:px-4 print:py-6 print:max-w-none">
      {/* Header */}
      <PrintVoucherHeader name={tenant.name} ntn={tenant.ntn} title="Sale Invoice" />

      {/* Meta */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6">
        <div className="flex gap-2">
          <span className="text-gray-500 w-28 shrink-0">Serial No.</span>
          <span className="font-mono font-bold">{invoice.serialNumber ?? '—'}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-24 shrink-0">Date</span>
          <span className="font-semibold">{formatPKTDate(new Date(invoice.date))}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-28 shrink-0">Voucher No.</span>
          <span className="font-mono font-bold">{invoice.voucherNo}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-28 shrink-0">Customer</span>
          <span className="font-semibold">{invoice.customerName}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-24 shrink-0">Entry Time</span>
          <span className="font-semibold">{invoice.entryTime}</span>
        </div>
        {invoice.paymentDueDate && (
          <div className="flex gap-2">
            <span className="text-gray-500 w-28 shrink-0">Payment Due</span>
            <span className="font-semibold">{formatPKTDate(new Date(invoice.paymentDueDate))}</span>
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
          {lines.map((line, i) => (
            <tr key={line.id} className={i % 2 === 1 ? 'bg-gray-50 print:bg-gray-50' : ''}>
              <td className="px-3 py-2.5 border-r border-gray-200 text-gray-500 tabular-nums">{i + 1}</td>
              <td className="px-3 py-2.5 border-r border-gray-200 font-medium">{line.name}</td>
              <td className="px-3 py-2.5 border-r border-gray-200 text-right tabular-nums">
                {line.qty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                {line.uom ? <span className="ml-1 text-gray-500 text-xs">{line.uom}</span> : null}
              </td>
              <td className="px-3 py-2.5 border-r border-gray-200 text-right tabular-nums whitespace-nowrap">
                {currencyCode} {fmt(line.rate)}
                {showCostWarnings && line.belowCost && line.cost !== null && (
                  <span className="block text-[10px] text-amber-600 print:text-amber-700">⚠ Below cost (Rs {fmt(line.cost)})</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold">Rs {fmt(line.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-gray-300 bg-gray-100 print:bg-gray-100">
          <tr>
            <td colSpan={4} className="px-3 py-2 text-right font-semibold text-[11px] uppercase tracking-wide border-r border-gray-300">Total</td>
            <td className="px-3 py-2 text-right font-extrabold tabular-nums">Rs {fmt(totalPKR)}</td>
          </tr>
        </tfoot>
      </table>

      {invoice.paymentDueDate && (
        <div className="text-sm text-gray-500 mb-4">
          Payment due by <span className="font-semibold text-gray-700">{formatPKTDate(new Date(invoice.paymentDueDate))}</span>
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
  )
}
