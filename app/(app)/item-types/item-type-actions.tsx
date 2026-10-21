'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteItemTypeAction } from '@/app/actions/delete-item-type'

type SubType = { id: string; name: string }

export function ItemTypeActions({ id, name, subTypes = [] }: { id: string; name: string; subTypes?: SubType[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const onDelete = () => {
    const extra = subTypes.length > 0 ? ` Its ${subTypes.length} sub-type${subTypes.length > 1 ? 's' : ''} will also be removed.` : ''
    if (!confirm(`Delete item type "${name}"?${extra}`)) return
    startTransition(async () => {
      const result = await deleteItemTypeAction(id)
      // A type still used by stock items can't be deleted (every item needs one).
      if (!result.success) { alert(result.error); return }
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
        <Link href={`/item-types/${id}/edit`}>
          <Pencil className="size-4" />
        </Link>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}
