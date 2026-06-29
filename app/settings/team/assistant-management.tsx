'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  resetAssistantPasswordAction,
  deactivateAssistantAction,
  reactivateAssistantAction,
} from '@/app/actions/manage-assistant'

type Props = {
  assistantEmail: string
  isActive: boolean
}

export function AssistantManagement({ assistantEmail, isActive }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleReset = async () => {
    setError(null)
    const result = await resetAssistantPasswordAction()
    if (!result.success) {
      setError(result.error)
      return
    }
    setTempPassword(result.data.tempPassword)
  }

  const handleDeactivate = () => {
    startTransition(async () => {
      setError(null)
      const result = await deactivateAssistantAction()
      if (!result.success) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  const handleReactivate = () => {
    startTransition(async () => {
      setError(null)
      const result = await reactivateAssistantAction()
      if (!result.success) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Assistant</CardTitle>
          <span
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {isActive ? 'Active' : 'Deactivated'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{assistantEmail}</p>

        {tempPassword && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 space-y-1">
            <p className="text-xs font-medium text-green-700">New temporary password (shown once)</p>
            <p className="font-mono text-sm break-all">{tempPassword}</p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col gap-2">
          {/* Reset Password */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full min-h-[44px]" disabled={!isActive}>
                Reset Password
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset assistant password?</DialogTitle>
                <DialogDescription>
                  A new temporary password will be generated. Share it with your assistant — they
                  should change it after logging in.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => {}}>
                  Cancel
                </Button>
                <Button onClick={handleReset} disabled={isPending}>
                  Reset Password
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Deactivate / Reactivate */}
          {isActive ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full min-h-[44px]" disabled={isPending}>
                  Deactivate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Deactivate assistant?</DialogTitle>
                  <DialogDescription>
                    Your assistant will be immediately logged out and unable to sign in until you
                    reactivate their account.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {}}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDeactivate} disabled={isPending}>
                    Deactivate
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button
              variant="outline"
              className="w-full min-h-[44px]"
              onClick={handleReactivate}
              disabled={isPending}
            >
              Reactivate
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
