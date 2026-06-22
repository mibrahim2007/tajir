'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

type Props = {
  customers: { id: string; name: string }[]
  lots:      { id: string; name: string }[]
}

export function SaleFilters({ customers, lots }: Props) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  const set = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  const hasFilters = searchParams.has('from') || searchParams.has('to') ||
    searchParams.has('customer') || searchParams.has('item')

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <Input
        type="date" placeholder="From"
        value={searchParams.get('from') ?? ''}
        onChange={e => set('from', e.target.value)}
        className="w-36 min-h-[44px]"
      />
      <Input
        type="date" placeholder="To"
        value={searchParams.get('to') ?? ''}
        onChange={e => set('to', e.target.value)}
        className="w-36 min-h-[44px]"
      />
      <Select
        value={searchParams.get('customer') ?? 'all'}
        onValueChange={v => set('customer', v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-44 min-h-[44px]"><SelectValue placeholder="All Customers" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Customers</SelectItem>
          {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select
        value={searchParams.get('item') ?? 'all'}
        onValueChange={v => set('item', v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-44 min-h-[44px]"><SelectValue placeholder="All Items" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Items</SelectItem>
          {lots.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button variant="ghost" className="min-h-[44px]" onClick={() => router.push(pathname)}>
          Clear
        </Button>
      )}
    </div>
  )
}
