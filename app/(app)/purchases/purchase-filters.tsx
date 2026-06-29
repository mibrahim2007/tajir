'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

type Props = {
  suppliers: { id: string; name: string }[]
  lots:      { id: string; name: string }[]
  locations: { id: string; name: string }[]
}

export function PurchaseFilters({ suppliers, lots, locations }: Props) {
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
    searchParams.has('supplier') || searchParams.has('item') || searchParams.has('location')

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
        value={searchParams.get('supplier') ?? 'all'}
        onValueChange={v => set('supplier', v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-44 min-h-[44px]"><SelectValue placeholder="All Suppliers" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Suppliers</SelectItem>
          {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
      {locations.length > 0 && (
        <Select
          value={searchParams.get('location') ?? 'all'}
          onValueChange={v => set('location', v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-44 min-h-[44px]"><SelectValue placeholder="All Locations" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {hasFilters && (
        <Button variant="ghost" className="min-h-[44px]" onClick={() => router.push(pathname)}>
          Clear
        </Button>
      )}
    </div>
  )
}
