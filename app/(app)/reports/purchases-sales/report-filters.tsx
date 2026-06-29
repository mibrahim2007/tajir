'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function ReportFilters() {
  const router = useRouter()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 7) + '-01'

  const from = params.get('from') ?? firstOfMonth
  const to = params.get('to') ?? today
  const type = params.get('type') ?? 'all'

  function apply(updates: Record<string, string>) {
    const next = new URLSearchParams(params.toString())
    Object.entries(updates).forEach(([k, v]) => next.set(k, v))
    startTransition(() => router.push(`?${next}`))
  }

  return (
    <div className="flex flex-wrap items-end gap-3 mb-6 print:hidden">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">From</label>
        <Input
          type="date"
          className="min-h-[44px] w-36"
          defaultValue={from}
          onBlur={(e) => apply({ from: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">To</label>
        <Input
          type="date"
          className="min-h-[44px] w-36"
          defaultValue={to}
          onBlur={(e) => apply({ to: e.target.value })}
        />
      </div>
      <div className="flex gap-1">
        {(['all', 'purchases', 'sales'] as const).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={type === t ? 'default' : 'outline'}
            className="capitalize min-h-[44px]"
            onClick={() => apply({ type: t })}
            disabled={isPending}
          >
            {t === 'all' ? 'All' : t === 'purchases' ? 'Purchases' : 'Sales'}
          </Button>
        ))}
      </div>
    </div>
  )
}
