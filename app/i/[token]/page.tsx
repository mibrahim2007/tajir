import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PrintButton } from '@/components/print-button'
import { SaleInvoiceDocument } from '@/components/sale-invoice-document'
import { loadSaleInvoice, loadSaleOrder } from '@/lib/sales/load-sale-invoice'
import { verifySaleShareToken } from '@/lib/sales/invoice-share-token'

// Shared invoice links must never be indexed by search engines.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function PublicSaleInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const parsed = verifySaleShareToken(decodeURIComponent(token))
  if (!parsed) notFound()

  // Customer-facing: never expose below-cost margin flags.
  const invoice = parsed.kind === 'invoice'
    ? await loadSaleInvoice(parsed.id, { includeCostWarnings: false })
    : await loadSaleOrder(parsed.id, { includeCostWarnings: false })
  if (!invoice) notFound()

  return (
    <div className="min-h-screen bg-white text-black">
      <style>{`@media print { @page { size: A4; margin: 12mm } html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact } }`}</style>

      <div className="print:hidden flex items-center gap-3 px-6 py-4 border-b bg-white sticky top-0">
        <span className="text-sm text-gray-500 flex-1">Sale Invoice · {invoice.voucherNo} · {invoice.tenant.name}</span>
        <PrintButton />
      </div>

      <SaleInvoiceDocument invoice={invoice} />

      <div className="print:hidden text-center text-xs text-gray-400 pb-10">
        Powered by Tajir
      </div>
    </div>
  )
}
