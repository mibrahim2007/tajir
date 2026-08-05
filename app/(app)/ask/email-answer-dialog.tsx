'use client'

import { useEffect, useState, useTransition } from 'react'
import { Mail, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { emailAskAnswerAction } from '@/app/actions/ask-email'
import { MAX_RECIPIENTS } from '@/lib/email/address'
import type { AskParty } from '@/lib/ask/types'

type Target = 'me' | 'party' | 'other'

type Props = {
  /** The question that produced the answer — the server re-runs it to send. */
  question: string
  party?: AskParty
  /** The signed-in user's own address, for the "send to me" option. */
  userEmail?: string
}

export function EmailAnswerDialog({ question, party, userEmail }: Props) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<Target>('me')
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string[] | null>(null)
  const [pending, startTransition] = useTransition()

  // Reopening after a send should offer a clean form, not the last result.
  useEffect(() => {
    if (!open) return
    setError(null)
    setSentTo(null)
    setTarget('me')
    setTo('')
    setNote('')
  }, [open])

  const partyHasEmail = Boolean(party?.email)

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const result = await emailAskAnswerAction({ question, target, to, note })
      if (!result.success) { setError(result.error); return }
      setSentTo(result.data.to)
    })
  }

  const option = (value: Target, label: string, detail: string, disabled = false) => (
    <label
      key={value}
      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
        disabled
          ? 'opacity-55 cursor-not-allowed'
          : target === value
            ? 'border-primary bg-accent/50 cursor-pointer'
            : 'bg-card hover:bg-accent/30 cursor-pointer'
      }`}
    >
      <input
        type="radio"
        name="ask-email-target"
        className="mt-1 accent-current"
        checked={target === value}
        disabled={disabled}
        onChange={() => setTarget(value)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground break-words">{detail}</span>
      </span>
    </label>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-card hover:bg-accent hover:text-primary transition-colors"
      >
        <Mail className="h-3.5 w-3.5" />
        Email this answer
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Email this answer</DialogTitle>
            <DialogDescription>
              Sent as a formatted table with a spreadsheet attached. The figures are read again when you send, so
              they are current.
            </DialogDescription>
          </DialogHeader>

          {sentTo ? (
            <div className="flex items-start gap-2.5 rounded-xl border bg-accent/40 px-3.5 py-3">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm min-w-0 break-words">
                Sent to <span className="font-medium">{sentTo.join(', ')}</span>.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                {option('me', 'Me', userEmail ?? 'Your account email')}

                {party &&
                  option(
                    'party',
                    party.name,
                    partyHasEmail
                      ? (party.email as string)
                      : `No email on file — add one on the ${party.type} record first`,
                    !partyHasEmail,
                  )}

                {option('other', 'Someone else', `Type up to ${MAX_RECIPIENTS} addresses`)}
              </div>

              {target === 'other' && (
                <Input
                  autoFocus
                  type="email"
                  inputMode="email"
                  placeholder="name@example.com, other@example.com"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              )}

              <div className="space-y-1.5">
                <label htmlFor="ask-email-note" className="text-xs font-medium text-muted-foreground">
                  Note (optional)
                </label>
                <Textarea
                  id="ask-email-note"
                  rows={2}
                  placeholder="Anything you want to say alongside the figures…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          <DialogFooter>
            {sentTo ? (
              <Button className="min-h-[44px]" onClick={() => setOpen(false)}>Done</Button>
            ) : (
              <>
                <Button variant="outline" className="min-h-[44px]" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button className="min-h-[44px]" onClick={submit} disabled={pending}>
                  {pending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</> : 'Send'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
