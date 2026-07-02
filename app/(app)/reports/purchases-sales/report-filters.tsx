'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Props = {
  locations: { id: string; name: string }[]
}

export function ReportFilters({ locations }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 7) + '-01'

  const from = params.get('from') ?? firstOfMonth
  const to = params.get('to') ?? today
  const type = params.get('type') ?? 'all'
  const location = params.get('location') ?? 'all'

  function apply(updates: Record<string, string>) {
    const next = new URLSearchParams(params.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (!v || v === 'all') next.delete(k)
      else next.set(k, v)
    })
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
      {locations.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Location</label>
          <Select value={location} onValueChange={(v) => apply({ location: v })} disabled={isPending}>
            <SelectTrigger className="w-44 min-h-[44px]"><SelectValue placeholder="All Locations" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
