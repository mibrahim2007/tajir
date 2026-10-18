import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { todayPKT } from '@/lib/utils/dates'
import { loadFbrFormData } from '@/lib/fbr/form-data'
import { scenarioById, type BuyerType } from '@/lib/fbr/scenarios'
import { lineTotals, type FbrLineInput } from '@/lib/fbr/calc'
import { FbrInvoiceForm } from '../../fbr-invoice-form'

export default async function EditFbrInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const d = await loadFbrFormData()
  const admin = createAdminClient()
  const [{ data: inv }, { data: items }] = await Promise.all([
    admin.from('fbr_invoices').select('*').eq('id', id).eq('tenant_id', d.tenantId).maybeSingle(),
    admin.from('fbr_invoice_items').select('*').eq('invoice_id', id).eq('tenant_id', d.tenantId).order('line_no'),
  ])
  if (!inv) notFound()
  if (inv.status === 'posted' || inv.status === 'posting') redirect(`/fbr-invoices/${id}`)

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-extrabold tracking-tight">Edit {inv.serial_number ?? 'FBR Tax Invoice'}</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-5">Not yet posted to FBR, so it can still be changed.</p>
      <FbrInvoiceForm
        today={todayPKT()} customers={d.customers} provinces={d.provinces} uoms={d.uoms}
        applicable={d.applicable} furtherTaxRate={d.furtherTaxRate}
        initial={{
          id: inv.id,
          invoiceType: inv.invoice_type as 'Sale Invoice' | 'Debit Note',
          invoiceDate: inv.invoice_date,
          buyerRegistrationType: inv.buyer_registration_type as BuyerType,
          buyerNtnCnic: inv.buyer_ntn_cnic ?? '',
          buyerBusinessName: inv.buyer_business_name,
          buyerProvince: inv.buyer_province,
          buyerAddress: inv.buyer_address,
          customerId: inv.customer_id,
          invoiceRefNo: inv.invoice_ref_no ?? '',
          scenarioId: inv.scenario_id ?? 'SN001',
          lines: (items ?? []).map((i) => {
            const q = Number(i.quantity)
            const line: FbrLineInput = {
              hsCode: i.hs_code, productDescription: i.product_description, uom: i.uom, quantity: q,
              unitPrice: Number(i.unit_price), discount: Number(i.discount), rate: i.rate,
              retailPrice: q > 0 ? Number(i.fixed_notified_value_or_retail_price) / q : 0,
              extraTax: Number(i.extra_tax), fedPayable: Number(i.fed_payable),
              salesTaxWithheldAtSource: Number(i.sales_tax_withheld_at_source),
              furtherTaxOverride: null,
              sroScheduleNo: i.sro_schedule_no ?? '', sroItemSerialNo: i.sro_item_serial_no ?? '',
            }
            // Keep a hand-typed further tax as typed; one that matched the auto figure stays automatic.
            const auto = lineTotals(line, {
              buyer: inv.buyer_registration_type as BuyerType,
              furtherTaxRate: d.furtherTaxRate,
              retailPrice: !!scenarioById(inv.scenario_id)?.retailPrice,
            }).furtherTax
            return Math.abs(auto - Number(i.further_tax)) < 0.01 ? line : { ...line, furtherTaxOverride: Number(i.further_tax) }
          }),
        }}
      />
    </div>
  )
}
