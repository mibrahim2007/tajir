'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

interface ExitButtonProps {
  isDirty: boolean
  onExit: () => void
  className?: string
}

export function ExitButton({ isDirty, onExit, className }: ExitButtonProps) {
  const [open, setOpen] = useState(false)

  const handleClick = () => {
    if (isDirty) setOpen(true)
    else onExit()
  }

  return (
    <>
      <Button type="button" variant="outline" className={className} onClick={handleClick}>
        Exit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Exit without saving?</DialogTitle>
            <DialogDescription>
              You have unsaved data on this form. If you exit now all entered information will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Keep Editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => { setOpen(false); onExit() }}
            >
              Exit Without Saving
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
