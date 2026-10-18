import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PrintButton } from '@/components/print-button'
import { Button } from '@/components/ui/button'
import { formatPKTDate } from '@/lib/utils/dates'

const fmt = (n: number) => n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Sales tax invoice printout. Spec §6: the FBR invoice number as a QR code,
// version 2 (25×25), printed 1 × 1 inch, alongside the Digital Invoicing logo.
export default async function PrintFbrInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const [{ data: inv }, { data: items }, { data: settings }] = await Promise.all([
    admin.from('fbr_invoices').select('*').eq('id', id).eq('tenant_id', tenantId).maybeSingle(),
    admin.from('fbr_invoice_items').select('*').eq('invoice_id', id).eq('tenant_id', tenantId).order('line_no'),
    admin.from('fbr_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
  ])
  if (!inv) notFound()

  const qr = inv.fbr_invoice_number
    ? await QRCode.toDataURL(inv.fbr_invoice_number, { version: 2, errorCorrectionLevel: 'M', margin: 1, width: 192 })
    : null
  const title = inv.invoice_type === 'Debit Note' ? 'Sales Tax Debit Note' : 'Sales Tax Invoice'

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white text-black print:p-0">
      <div className="flex justify-between gap-2 mb-4 print:hidden">
        <Button asChild variant="outline" className="min-h-[44px]"><Link href={`/fbr-invoices/${id}`}>← Back</Link></Button>
        <PrintButton />
      </div>

      {inv.status !== 'posted' && (
        <p className="mb-4 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          DRAFT — not yet posted to FBR. This printout is not a valid tax invoice.
        </p>
      )}
      {inv.environment === 'sandbox' && (
        <p className="mb-4 rounded border border-gray-400 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-center">
          FBR sandbox — test invoice, not for tax purposes
        </p>
      )}

      <div className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div>
          <p className="text-xl font-extrabold uppercase">{settings?.seller_business_name}</p>
          <p className="text-xs">NTN/CNIC: {settings?.seller_ntn_cnic}</p>
          <p className="text-xs">{settings?.seller_address}, {settings?.seller_province}</p>
          <p className="text-2xl font-bold uppercase tracking-wider mt-2">{title}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-[10px] font-bold uppercase leading-tight">FBR<br />Digital Invoicing<br />System</div>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR ${inv.fbr_invoice_number}`} style={{ width: '1in', height: '1in' }} />
          ) : (
            <div className="flex items-center justify-center border border-dashed text-[9px] text-center" style={{ width: '1in', height: '1in' }}>QR after posting</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 py-4 text-sm">
        <div>
          <p className="text-[11px] font-bold uppercase text-gray-600">Buyer ({inv.buyer_registration_type})</p>
          <p className="font-semibold">{inv.buyer_business_name}</p>
          <p>NTN/CNIC: {inv.buyer_ntn_cnic || '—'}</p>
          <p>{inv.buyer_address}, {inv.buyer_province}</p>
        </div>
        <div className="text-right space-y-0.5">
          <p><span className="text-gray-600">Invoice no.</span> <b>{inv.serial_number}</b></p>
          <p><span className="text-gray-600">Date</span> <b>{formatPKTDate(inv.invoice_date + 'T00:00:00')}</b></p>
          <p><span className="text-gray-600">FBR invoice no.</span> <b className="font-mono">{inv.fbr_invoice_number ?? '—'}</b></p>
          {inv.invoice_ref_no && <p><span className="text-gray-600">Against</span> <b className="font-mono">{inv.invoice_ref_no}</b></p>}
        </div>
      </div>

      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-y-2 border-black">
            <th className="text-left py-1.5 pr-2">#</th>
            <th className="text-left py-1.5 pr-2">HS code</th>
            <th className="text-left py-1.5 pr-2">Description</th>
            <th className="text-right py-1.5 pr-2">Qty</th>
            <th className="text-right py-1.5 pr-2">Value excl. ST</th>
            <th className="text-right py-1.5 pr-2">Rate</th>
            <th className="text-right py-1.5 pr-2">Sales tax</th>
            <th className="text-right py-1.5 pr-2">Further tax</th>
            <th className="text-right py-1.5">Total</th>
          </tr>
        </thead>
        <tbody>
          {(items ?? []).map((i) => (
            <tr key={i.id} className="border-b border-gray-300 align-top">
              <td className="py-1.5 pr-2">{i.line_no}</td>
              <td className="py-1.5 pr-2 font-mono">{i.hs_code}</td>
              <td className="py-1.5 pr-2">{i.product_description}</td>
              <td className="py-1.5 pr-2 text-right whitespace-nowrap">{Number(i.quantity)} {i.uom}</td>
              <td className="py-1.5 pr-2 text-right">{fmt(Number(i.value_sales_excluding_st))}</td>
              <td className="py-1.5 pr-2 text-right">{i.rate}</td>
              <td className="py-1.5 pr-2 text-right">{fmt(Number(i.sales_tax_applicable))}</td>
              <td className="py-1.5 pr-2 text-right">{fmt(Number(i.further_tax))}</td>
              <td className="py-1.5 text-right font-semibold">{fmt(Number(i.total_values))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black font-bold">
            <td colSpan={4} className="py-2">Total</td>
            <td className="py-2 pr-2 text-right">{fmt(Number(inv.total_value_excl_st))}</td>
            <td />
            <td className="py-2 pr-2 text-right">{fmt(Number(inv.total_sales_tax))}</td>
            <td className="py-2 pr-2 text-right">{fmt(Number(inv.total_further_tax))}</td>
            <td className="py-2 text-right">{fmt(Number(inv.total_amount))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
