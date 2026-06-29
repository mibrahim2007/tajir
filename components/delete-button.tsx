'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ActionResult } from '@/lib/types'

type Props = {
  label?: string
  description?: string
  onDelete: () => Promise<ActionResult<unknown>>
  onSuccess?: () => void
  size?: 'sm' | 'default'
}

export function DeleteButton({ label = 'Delete', description, onDelete, onSuccess, size = 'sm' }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const confirm = () => {
    startTransition(async () => {
      setError(null)
      const result = await onDelete()
      if (!result.success) {
        setError('error' in result ? result.error : 'Delete failed')
        return
      }
      setOpen(false)
      if (onSuccess) onSuccess()
      else router.refresh()
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size={size}
        className="text-destructive hover:text-destructive hover:bg-destructive/10 min-h-[44px]"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
        {size !== 'sm' && <span className="ml-2">{label}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              {description ?? 'This will permanently delete the record and reverse its impact on stock and balances.'}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
            <Button variant="destructive" onClick={confirm} disabled={isPending}>
              {isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
