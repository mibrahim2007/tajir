'use client'

import type { ComponentProps } from 'react'
import { SaleInvoiceForm } from '../sale-invoice-form'

// Create-mode wrapper; takes every SaleInvoiceForm prop except the edit ones.
export function CreateSaleForm(
  props: Omit<ComponentProps<typeof SaleInvoiceForm>, 'mode' | 'invoiceId' | 'initialValues'>,
) {
  return <SaleInvoiceForm mode="create" {...props} />
}
