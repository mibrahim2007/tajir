import type { Database } from '@/lib/supabase/database.types'
import type { FbrEnv } from './client'

type Settings = Database['public']['Tables']['fbr_settings']['Row']
type Invoice  = Database['public']['Tables']['fbr_invoices']['Row']
type Item     = Database['public']['Tables']['fbr_invoice_items']['Row']

/**
 * The DI API request body (spec §4.1 / §4.2), field names exactly as PRAL
 * expects them. Seller details come from the tenant's FBR settings at the
 * moment of sending; the body actually sent is stored on the invoice.
 */
export function buildFbrPayload(settings: Settings, inv: Invoice, items: Item[], env: FbrEnv) {
  const num = (x: number | string | null) => Number(x ?? 0)
  return {
    invoiceType:           inv.invoice_type,
    invoiceDate:           inv.invoice_date,
    sellerNTNCNIC:         settings.seller_ntn_cnic ?? '',
    sellerBusinessName:    settings.seller_business_name ?? '',
    sellerProvince:        settings.seller_province ?? '',
    sellerAddress:         settings.seller_address ?? '',
    buyerNTNCNIC:          inv.buyer_ntn_cnic ?? '',
    buyerBusinessName:     inv.buyer_business_name,
    buyerProvince:         inv.buyer_province,
    buyerAddress:          inv.buyer_address,
    buyerRegistrationType: inv.buyer_registration_type,
    invoiceRefNo:          inv.invoice_ref_no ?? '',
    ...(env === 'sandbox' ? { scenarioId: inv.scenario_id ?? '' } : {}),
    items: [...items].sort((a, b) => a.line_no - b.line_no).map((i) => ({
      hsCode:                          i.hs_code,
      productDescription:              i.product_description,
      rate:                            i.rate,
      uoM:                             i.uom,
      quantity:                        num(i.quantity),
      totalValues:                     num(i.total_values),
      valueSalesExcludingST:           num(i.value_sales_excluding_st),
      fixedNotifiedValueOrRetailPrice: num(i.fixed_notified_value_or_retail_price),
      salesTaxApplicable:              num(i.sales_tax_applicable),
      salesTaxWithheldAtSource:        num(i.sales_tax_withheld_at_source),
      extraTax:                        num(i.extra_tax),
      furtherTax:                      num(i.further_tax),
      sroScheduleNo:                   i.sro_schedule_no ?? '',
      fedPayable:                      num(i.fed_payable),
      discount:                        num(i.discount),
      saleType:                        i.sale_type,
      sroItemSerialNo:                 i.sro_item_serial_no ?? '',
    })),
  }
}
