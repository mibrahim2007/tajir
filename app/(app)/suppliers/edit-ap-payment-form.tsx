'use client'

import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Payment = { id: string }

// Payments are edited on their own page (multi-line tender + GL re-post), so
// this ledger-row control is just a link into that editor.
export function EditApPaymentForm({ payment }: { payment: Payment }) {
  return (
    <Link href={`/payments/${payment.id}/edit`}>
      <Button variant="ghost" size="sm" className="min-h-[44px]" title="Edit payment">
        <Pencil className="h-4 w-4" />
      </Button>
    </Link>
  )
}
