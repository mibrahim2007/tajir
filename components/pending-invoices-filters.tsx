'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

type Props = {
  parties:      { id: string; name: string }[]
  /** "Customers" / "Suppliers". */
  partiesLabel: string
  searchHint:   string
}

/** Filter bar for the Pending Receivables / Payables (invoice-wise) reports. */
export function PendingInvoicesFilters({ parties, partiesLabel, searchHint }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const set = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  const hasFilters = searchParams.has('party') || searchParams.has('status') || searchParams.has('q')

  return (
    <div className="flex flex-wrap gap-2 mb-6 print:hidden">
      <Select
        value={searchParams.get('party') ?? 'all'}
        onValueChange={v => set('party', v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-full sm:w-56 min-h-[44px]"><SelectValue placeholder={`All ${partiesLabel}`} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All {partiesLabel}</SelectItem>
          {parties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select
        value={searchParams.get('status') ?? 'all'}
        onValueChange={v => set('status', v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-full sm:w-44 min-h-[44px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All pending</SelectItem>
          <SelectItem value="overdue">Overdue only</SelectItem>
          <SelectItem value="current">Not yet due</SelectItem>
        </SelectContent>
      </Select>
      {/* defaultValue + onBlur so typing doesn't re-navigate on every keystroke. */}
      <Input
        type="search"
        placeholder={searchHint}
        aria-label={searchHint.replace('…', '')}
        defaultValue={searchParams.get('q') ?? ''}
        onBlur={e => set('q', e.target.value.trim())}
        onKeyDown={e => { if (e.key === 'Enter') set('q', e.currentTarget.value.trim()) }}
        className="w-full sm:w-56 min-h-[44px]"
      />
      {hasFilters && (
        <Button variant="ghost" className="min-h-[44px]" onClick={() => router.push(pathname)}>
          Clear
        </Button>
      )}
    </div>
  )
}
