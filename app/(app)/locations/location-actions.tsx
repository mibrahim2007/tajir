'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteLocationAction } from '@/app/actions/delete-location'

export function LocationActions({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      onClick={() => {
        if (!confirm(`Delete location "${name}"?`)) return
        startTransition(async () => {
          await deleteLocationAction(id)
          router.refresh()
        })
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  )
}
