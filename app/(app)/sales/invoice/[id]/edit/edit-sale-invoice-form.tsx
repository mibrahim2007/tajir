'use client'

import type { ComponentProps } from 'react'
import { SaleInvoiceForm, type SaleFormValues } from '../../../sale-invoice-form'

// Edit-mode wrapper: the invoice id and its current values are required.
export function EditSaleInvoiceForm(
  props: Omit<ComponentProps<typeof SaleInvoiceForm>, 'mode' | 'invoiceId' | 'initialValues'> & {
    invoiceId:     string
    initialValues: SaleFormValues
  },
) {
  return <SaleInvoiceForm mode="edit" {...props} />
}
