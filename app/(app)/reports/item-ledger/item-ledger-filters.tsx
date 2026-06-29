'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

type Props = {
  lots: { id: string; name: string }[]
}

export function ItemLedgerFilters({ lots }: Props) {
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
        value={searchParams.get('item') ?? 'none'}
        onValueChange={v => set('item', v === 'none' ? '' : v)}
      >
        <SelectTrigger className="w-56 min-h-[44px]"><SelectValue placeholder="Select stock item…" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Select stock item…</SelectItem>
          {lots.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={searchParams.get('from') ?? ''}
        onChange={e => set('from', e.target.value)}
        className="w-36 min-h-[44px]"
      />
      <Input
        type="date"
        value={searchParams.get('to') ?? ''}
        onChange={e => set('to', e.target.value)}
        className="w-36 min-h-[44px]"
      />
      {searchParams.has('item') && (
        <Button variant="outline" className="min-h-[44px]" onClick={() => {
          const params = new URLSearchParams(searchParams.toString())
          params.delete('item')
          router.push(`${pathname}?${params.toString()}`)
        }}>
          Change Item
        </Button>
      )}
    </div>
  )
}
