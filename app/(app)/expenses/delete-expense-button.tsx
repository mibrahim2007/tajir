'use client'

import { DeleteButton } from '@/components/delete-button'
import { deleteExpenseAction } from '@/app/actions/delete-expense'

export function DeleteExpenseButton({ id }: { id: string }) {
  return <DeleteButton onDelete={() => deleteExpenseAction({ id })} />
}
