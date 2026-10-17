'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

type Props = {
  customers: { id: string; name: string }[]
}

export function PendingReceivablesFilters({ customers }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const set = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  const hasFilters = searchParams.has('customer') || searchParams.has('status') || searchParams.has('q')

  return (
    <div className="flex flex-wrap gap-2 mb-6 print:hidden">
      <Select
        value={searchParams.get('customer') ?? 'all'}
        onValueChange={v => set('customer', v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-full sm:w-56 min-h-[44px]"><SelectValue placeholder="All Customers" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Customers</SelectItem>
          {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
        placeholder="Voucher / PO no…"
        aria-label="Search voucher or PO number"
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
