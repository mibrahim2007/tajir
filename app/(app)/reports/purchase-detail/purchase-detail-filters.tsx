'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

type Props = {
  suppliers: { id: string; name: string }[]
}

export function PurchaseDetailFilters({ suppliers }: Props) {
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
    searchParams.has('supplier') || searchParams.has('q')

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
        value={searchParams.get('supplier') ?? 'all'}
        onValueChange={v => set('supplier', v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-52 min-h-[44px]"><SelectValue placeholder="All Suppliers" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Suppliers</SelectItem>
          {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {/* Searches both the supplier's bill number and our own voucher number.
          defaultValue + onBlur so typing doesn't re-navigate on every keystroke. */}
      <Input
        type="search"
        placeholder="Supplier invoice / voucher no…"
        aria-label="Search supplier invoice or voucher number"
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
