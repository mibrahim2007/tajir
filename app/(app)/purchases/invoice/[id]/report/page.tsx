import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenant } from '@/lib/auth/get-tenant'
import { Button } from '@/components/ui/button'
import { PrintButton } from '@/components/print-button'
import { formatPKTDate, formatPKTDateTime } from '@/lib/utils/dates'
import { amountToWordsPKR } from '@/lib/utils/number-to-words'

function fmt(n: number) {
  return n.toLocaleString('en-PK', { maximumFractionDigits: 2 })
}

// Full-page A4 "report copy" of a purchase invoice — a formal document
// (distinct from the compact voucher print at ../print).
export default async function PurchaseInvoiceReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: invoiceId } = await params
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: lines }, tenant] = await Promise.all([
    admin.from('purchase_orders')
      .select('id, serial_number, date, created_at, quantity, rate, currency_code, exchange_rate, pkr_equivalent, advance_paid, supplier_id, stock_item_id, yarn_type, yarn_weight, multiply_by')
      .eq('invoice_id', invoiceId)
      .eq('tenant_id', tenantId)
      .order('created_at'),
    getTenant(tenantId),
  ])

  if (!lines || lines.length === 0) notFound()

  const first = lines[0]
  const stockIds    = [...new Set(lines.map((l) => l.stock_item_id))]
  const supplierIds = [...new Set(lines.map((l) => l.supplier_id))]

  const [{ data: stockItems }, { data: suppliers }, { data: journalEntry }] = await Promise.all([
    admin.from('inventory_lots').select('id, name, unit_of_measure').in('id', stockIds),
    admin.from('suppliers').select('id, name').in('id', supplierIds),
    admin.from('tajir_journal_entries')
      .select('voucher_number')
      .eq('source_id', invoiceId)
      .eq('source_type', 'purchase_invoice')
      .single(),
  ])

  const stockMap    = new Map((stockItems ?? []).map((s) => [s.id, { name: s.name, uom: s.unit_of_measure ?? null }]))
  const supplierMap = new Map((suppliers ?? []).map((s) => [s.id, s.name]))

  const totalPKR    = lines.reduce((s, l) => s + l.pkr_equivalent, 0)
  const advancePaid = lines.reduce((s, l) => s + l.advance_paid, 0)
  const balanceDue  = totalPKR - advancePaid
  const er          = first.exchange_rate
  const isUSD       = first.currency_code === 'USD'
  const voucherNo   = journalEntry?.voucher_number ?? `PI-${invoiceId.slice(-6).toUpperCase()}`
  const supplierName = supplierMap.get(first.supplier_id) ?? '—'
  const generatedAt = formatPKTDateTime(new Date())

  const metaRow = (label: string, value: string) => (
    <div className="flex justify-between gap-4 py-1 border-b border-gray-200 last:border-b-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-900 text-right">{value}</span>
    </div>
  )

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <style>{`@media print { @page { size: A4; margin: 14mm } html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact } }`}</style>

      {/* Toolbar (screen only) */}
      <div className="print:hidden flex items-center gap-3 px-6 py-4 border-b bg-background sticky top-0 z-10">
        <Link href="/purchases">
          <Button variant="ghost" size="sm">← Back</Button>
        </Link>
        <span className="text-sm text-muted-foreground flex-1">A4 Report · Purchase Invoice · {voucherNo} · {lines.length} item{lines.length !== 1 ? 's' : ''}</span>
        <Link href={`/purchases/invoice/${invoiceId}/print`} className="print:hidden">
          <Button variant="ghost" size="sm">Compact print</Button>
        </Link>
        <PrintButton />
      </div>

      {/* A4 document */}
      <div className="mx-auto w-full max-w-[820px] px-10 py-10 print:px-0 print:py-0 print:max-w-none">

        {/* Letterhead */}
        <div className="flex items-start justify-between gap-6 border-b-4 border-gray-900 pb-4">
          <div>
            <h1 className="text-2xl font-extrabold uppercase tracking-wide">{tenant.name}</h1>
            {tenant.ntn && <p className="text-xs font-semibold text-gray-600 mt-1">NTN: {tenant.ntn}</p>}
          </div>
          <div className="text-right">
            <p className="text-3xl font-black uppercase tracking-widest text-gray-900">Purchase</p>
            <p className="text-xs text-gray-500 mt-1">Purchase Invoice</p>
          </div>
        </div>

        {/* Supplier + Invoice meta */}
        <div className="grid grid-cols-2 gap-8 mt-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Supplier</p>
            <p className="text-lg font-bold">{supplierName}</p>
          </div>
          <div className="text-sm">
            {metaRow('Invoice / Voucher No.', voucherNo)}
            {first.serial_number && metaRow('Serial No.', first.serial_number)}
            {metaRow('Invoice Date', formatPKTDate(new Date(first.date)))}
            {isUSD && metaRow('Exchange Rate', `1 USD = Rs ${fmt(er)}`)}
          </div>
        </div>

        {/* Line items */}
        <table className="w-full text-sm mt-6 border border-gray-300 border-collapse">
          <thead className="bg-gray-900 text-white print:bg-gray-900">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold text-[11px] uppercase tracking-wide w-10">#</th>
              <th className="text-left px-3 py-2.5 font-semibold text-[11px] uppercase tracking-wide">Description</th>
              <th className="text-right px-3 py-2.5 font-semibold text-[11px] uppercase tracking-wide w-28">Qty</th>
              <th className="text-right px-3 py-2.5 font-semibold text-[11px] uppercase tracking-wide w-36">Rate</th>
              <th className="text-right px-3 py-2.5 font-semibold text-[11px] uppercase tracking-wide w-40">Amount (PKR)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={line.id} className={`border-b border-gray-200 ${i % 2 === 1 ? 'bg-gray-50 print:bg-gray-50' : ''}`}>
                <td className="px-3 py-2.5 text-gray-500 tabular-nums align-top">{i + 1}</td>
                <td className="px-3 py-2.5 font-medium align-top">
                  {stockMap.get(line.stock_item_id)?.name ?? '—'}
                  {(line.yarn_type || line.yarn_weight != null || (line.multiply_by != null && Number(line.multiply_by) !== 1)) && (
                    <span className="block text-[10px] text-gray-500 font-normal">
                      {[
                        line.yarn_type,
                        line.yarn_weight != null ? `Wt ${fmt(Number(line.yarn_weight))}` : null,
                        line.multiply_by != null && Number(line.multiply_by) !== 1 ? `× ${fmt(Number(line.multiply_by))}` : null,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums align-top">
                  {line.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                  {stockMap.get(line.stock_item_id)?.uom ? <span className="ml-1 text-gray-500 text-xs">{stockMap.get(line.stock_item_id)!.uom}</span> : null}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums align-top whitespace-nowrap">{first.currency_code} {fmt(line.rate)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold align-top">Rs {fmt(line.pkr_equivalent)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mt-4">
          <div className="w-72 text-sm">
            <div className="flex justify-between py-1.5 border-b border-gray-200">
              <span className="text-gray-500">Total Amount</span>
              <span className="tabular-nums font-medium">Rs {fmt(totalPKR)}</span>
            </div>
            {advancePaid > 0 && (
              <div className="flex justify-between py-1.5 border-b border-gray-200">
                <span className="text-gray-500">Advance Paid</span>
                <span className="tabular-nums font-medium text-green-700">Rs {fmt(advancePaid)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 mt-1 bg-gray-900 text-white px-3 rounded print:bg-gray-900">
              <span className="font-bold uppercase text-[12px] tracking-wide">Balance Due</span>
              <span className="tabular-nums font-extrabold text-base">Rs {fmt(balanceDue)}</span>
            </div>
          </div>
        </div>

        {/* Amount in words */}
        <div className="mt-4 border border-gray-300 rounded px-4 py-3 text-sm">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mr-2">Amount in words:</span>
          <span className="font-semibold">{amountToWordsPKR(totalPKR)}</span>
        </div>

        {/* Signatures */}
        <div className="flex justify-between mt-16 print:mt-12 pt-4 text-sm text-center gap-6">
          <div className="flex-1"><div className="border-t border-black pt-2 text-gray-500">Prepared By</div></div>
          <div className="flex-1"><div className="border-t border-black pt-2 text-gray-500">Supplier Representative</div></div>
          <div className="flex-1"><div className="border-t border-black pt-2 text-gray-500">Authorized Signatory</div></div>
        </div>

        {/* Footer */}
        <p className="mt-8 pt-3 border-t border-gray-200 text-center text-[10px] text-gray-400">
          Computer-generated purchase invoice · Generated {generatedAt}
        </p>
      </div>
    </div>
  )
}
