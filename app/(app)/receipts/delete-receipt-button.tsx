'use client'

import { DeleteButton } from '@/components/delete-button'
import { deleteArReceiptAction } from '@/app/actions/delete-ar-receipt'

export function DeleteReceiptButton({ id }: { id: string }) {
  return <DeleteButton onDelete={() => deleteArReceiptAction({ id })} />
}
