import { todayPKT } from '@/lib/utils/dates'
import { loadFbrFormData } from '@/lib/fbr/form-data'
import { FbrInvoiceForm } from '../fbr-invoice-form'

export default async function NewFbrInvoicePage() {
  const d = await loadFbrFormData()
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-extrabold tracking-tight">New FBR Tax Invoice</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Choose a registered or unregistered buyer, fill the lines, save — then validate and post to FBR
        ({d.settings.environment === 'sandbox' ? 'sandbox' : 'production'}).
      </p>
      <FbrInvoiceForm
        today={todayPKT()} customers={d.customers} provinces={d.provinces} uoms={d.uoms}
        applicable={d.applicable} furtherTaxRate={d.furtherTaxRate}
      />
    </div>
  )
}
