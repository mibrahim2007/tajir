'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { setPeriodLockAction } from '@/app/actions/set-period-lock'

export function PeriodLockForm({
  lockedThrough,
  today,
}: {
  lockedThrough: string | null
  today: string
}) {
  const router = useRouter()
  const [date, setDate] = useState(lockedThrough ?? '')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Clearing or pulling the date back reopens closed books, so it takes a
  // second click rather than firing on the first.
  const [armedClear, setArmedClear] = useState(false)
  const [isPending, startTransition] = useTransition()

  const movingBack = !!lockedThrough && !!date && date < lockedThrough

  const submit = (value: string | null) => {
    startTransition(async () => {
      setError(null)
      const result = await setPeriodLockAction({ lockedThrough: value, note })
      if (!result.success) { setError(result.error); return }
      setNote('')
      setArmedClear(false)
      router.refresh()
    })
  }

  return (
    <div className="bg-card rounded-2xl border shadow-sm px-4 py-4 space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">Lock everything up to and including</label>
        <Input
          type="date"
          value={date}
          max={today}
          className="min-h-[44px]"
          onChange={(e) => { setDate(e.target.value); setError(null) }}
        />
        <p className="text-xs text-muted-foreground">
          Usually the last day of a closed month or financial year.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">Note (optional)</label>
        <Input
          placeholder="e.g. FY 2026 audited and signed off"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {movingBack && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          This moves the lock date backwards, reopening everything between{' '}
          {date} and {lockedThrough} for editing.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          className="min-h-[44px]"
          disabled={isPending || !date || date === lockedThrough}
          onClick={() => submit(date)}
        >
          {isPending ? 'Saving…' : lockedThrough ? 'Update Lock Date' : 'Lock Period'}
        </Button>

        {lockedThrough && (
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            disabled={isPending}
            onBlur={() => setArmedClear(false)}
            onClick={() => (armedClear ? submit(null) : setArmedClear(true))}
          >
            {armedClear ? 'Confirm — reopen everything?' : 'Clear Lock'}
          </Button>
        )}
      </div>
    </div>
  )
}
