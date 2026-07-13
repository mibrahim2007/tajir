import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { Button } from '@/components/ui/button'
import { PrintButton } from '@/components/print-button'
import { SendWhatsAppButton } from '@/components/send-whatsapp-button'
import { SaleInvoiceDocument } from '@/components/sale-invoice-document'
import { loadSaleOrder } from '@/lib/sales/load-sale-invoice'
import { signSaleShareToken } from '@/lib/sales/invoice-share-token'
import { getBaseUrl } from '@/lib/utils/base-url'
import { toWaNumber } from '@/lib/utils/phone'

function fmt(n: number) {
  return n.toLocaleString('en-PK', { maximumFractionDigits: 2 })
}

export default async function PrintSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId } = await requireAuth()

  const invoice = await loadSaleOrder(id, { includeCostWarnings: true })
  if (!invoice) notFound()
  // Tenant isolation: the loader keys purely on the order id, so verify ownership here.
  if (invoice.tenantId !== tenantId) notFound()

  const shareUrl = `${getBaseUrl()}/i/${signSaleShareToken('order', id)}`
  const waMessage =
    `Assalam-o-Alaikum ${invoice.customerName},\n\n` +
    `Sale Invoice ${invoice.voucherNo} from ${invoice.tenant.name}\n` +
    `Amount: Rs ${fmt(invoice.totalPKR)}\n\n` +
    `View / download your invoice:\n${shareUrl}`

  return (
    <div className="min-h-screen bg-white">
      {/* Keep the invoice on a single printed page */}
      <style>{`@media print { @page { size: A4; margin: 12mm } html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact } }`}</style>
      {/* Screen toolbar — hidden on print */}
      <div className="print:hidden flex items-center gap-3 px-6 py-4 border-b bg-background sticky top-0">
        <Link href="/sales">
          <Button variant="ghost" size="sm">← Back</Button>
        </Link>
        <span className="text-sm text-muted-foreground flex-1">Sale Invoice · {invoice.voucherNo}</span>
        <SendWhatsAppButton waNumber={toWaNumber(invoice.customerPhone)} message={waMessage} />
        <PrintButton />
      </div>

      <SaleInvoiceDocument invoice={invoice} showCostWarnings />
    </div>
  )
}
