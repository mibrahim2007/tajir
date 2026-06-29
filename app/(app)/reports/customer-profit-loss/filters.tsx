'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Props = { customers: { id: string; name: string }[] }

export function CustomerPLFilters({ customers }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const set = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <Select
        value={searchParams.get('customer') ?? 'all'}
        onValueChange={v => set('customer', v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-64 min-h-[44px]"><SelectValue placeholder="All Customers" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Customers</SelectItem>
          {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input type="date" value={searchParams.get('from') ?? ''} onChange={e => set('from', e.target.value)} className="w-36 min-h-[44px]" />
      <Input type="date" value={searchParams.get('to')   ?? ''} onChange={e => set('to',   e.target.value)} className="w-36 min-h-[44px]" />
    </div>
  )
}
