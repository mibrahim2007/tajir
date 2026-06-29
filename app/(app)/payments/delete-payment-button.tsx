'use client'

import { DeleteButton } from '@/components/delete-button'
import { deleteApPaymentAction } from '@/app/actions/delete-ap-payment'

export function DeletePaymentButton({ id }: { id: string }) {
  return <DeleteButton onDelete={() => deleteApPaymentAction({ id })} />
}
