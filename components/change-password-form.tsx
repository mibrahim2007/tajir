'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { changePasswordAction } from '@/app/actions/change-password'

export function ChangePasswordForm() {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setIsPending(true)
    const fd = new FormData()
    fd.set('password', password)
    const result = await changePasswordAction(fd)
    if (result && !result.success) {
      setError(result.error)
      setIsPending(false)
    }
    // On success the server action redirects — no further state update needed
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Set Your Password</CardTitle>
        <CardDescription>
          You are logging in for the first time. Please set a personal password to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              placeholder="Repeat your new password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
            {isPending ? 'Saving…' : 'Set Password & Continue'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
