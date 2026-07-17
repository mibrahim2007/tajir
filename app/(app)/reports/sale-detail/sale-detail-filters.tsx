'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

type Props = {
  customers: { id: string; name: string }[]
}

export function SaleDetailFilters({ customers }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const set = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  const hasFilters = searchParams.has('from') || searchParams.has('to') ||
    searchParams.has('customer') || searchParams.has('q')

  return (
    <div className="flex flex-wrap gap-2 mb-6 print:hidden">
      <Input
        type="date" aria-label="From date"
        value={searchParams.get('from') ?? ''}
        onChange={e => set('from', e.target.value)}
        className="w-36 min-h-[44px]"
      />
      <Input
        type="date" aria-label="To date"
        value={searchParams.get('to') ?? ''}
        onChange={e => set('to', e.target.value)}
        className="w-36 min-h-[44px]"
      />
      <Select
        value={searchParams.get('customer') ?? 'all'}
        onValueChange={v => set('customer', v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-52 min-h-[44px]"><SelectValue placeholder="All Customers" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Customers</SelectItem>
          {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {/* Searches PO no., DC no. and our own voucher number.
          defaultValue + onBlur so typing doesn't re-navigate on every keystroke. */}
      <Input
        type="search"
        placeholder="PO / DC / voucher no…"
        aria-label="Search PO, DC or voucher number"
        defaultValue={searchParams.get('q') ?? ''}
        onBlur={e => set('q', e.target.value.trim())}
        onKeyDown={e => { if (e.key === 'Enter') set('q', e.currentTarget.value.trim()) }}
        className="w-60 min-h-[44px]"
      />
      {hasFilters && (
        <Button variant="ghost" className="min-h-[44px]" onClick={() => router.push(pathname)}>
          Clear
        </Button>
      )}
    </div>
  )
}
