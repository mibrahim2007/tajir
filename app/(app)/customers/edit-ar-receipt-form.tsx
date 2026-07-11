'use client'

import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Receipt = { id: string }

// Receipts are edited on their own page (multi-line tender + GL re-post), so
// this ledger-row control is just a link into that editor.
export function EditArReceiptForm({ receipt }: { receipt: Receipt }) {
  return (
    <Link href={`/receipts/${receipt.id}/edit`}>
      <Button variant="ghost" size="sm" className="min-h-[44px]" title="Edit receipt">
        <Pencil className="h-4 w-4" />
      </Button>
    </Link>
  )
}
