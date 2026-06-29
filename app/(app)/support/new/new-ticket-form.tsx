'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { createSupportTicketAction } from '@/app/actions/create-support-ticket'

export function NewTicketForm() {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    start(async () => {
      setError(null)
      const res = await createSupportTicketAction({
        subject: fd.get('subject') as string,
        message: fd.get('message') as string,
      })
      if (!res.success) { setError(res.error); return }
      router.push(`/support/${res.data!.id}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          name="subject"
          placeholder="Brief description of your issue"
          required
          minLength={3}
          maxLength={200}
          className="min-h-[44px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          name="message"
          placeholder="Please describe your issue in detail. Include any relevant information such as dates, amounts, or error messages."
          required
          minLength={10}
          maxLength={5000}
          rows={7}
          className="resize-none"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={isPending} className="min-h-[44px]">
          {isPending ? 'Submitting…' : 'Submit Ticket'}
        </Button>
        <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
