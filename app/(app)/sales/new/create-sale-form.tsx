'use client'

import { SaleInvoiceForm } from '../sale-invoice-form'

type Customer    = { id: string; name: string }
type StockItem   = { id: string; name: string; currentQuantity: number; barcode: string | null; unitOfMeasure: string | null; itemNature: 'inventory' | 'service' }
type PricingRule = { customerId: string; stockItemId: string; rate: number }
type LocationStock = { stockItemId: string; locationId: string; quantity: number }

export function CreateSaleForm(props: {
  today: string
  customers:         Customer[]
  suppliers?:        Customer[]
  stockItems:        StockItem[]
  pricingRules:      PricingRule[]
  isOwner:           boolean
  locations:         { id: string; name: string }[]
  locationStock:     LocationStock[]
  costMap:           Record<string, number>
  customerBalanceMap?: Record<string, number>
}) {
  return <SaleInvoiceForm mode="create" {...props} />
}
