'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export function InventoryFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete('page') // reset pagination on filter change
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  const hasFilters =
    searchParams.has('count') ||
    searchParams.has('type') ||
    searchParams.has('fiber') ||
    searchParams.has('lot')

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <Input
        placeholder="Count (e.g. 30s)"
        defaultValue={searchParams.get('count') ?? ''}
        className="w-36 min-h-[44px]"
        onChange={(e) => updateParam('count', e.target.value)}
      />

      <Select
        value={searchParams.get('type') ?? 'all'}
        onValueChange={(v) => updateParam('type', v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-36 min-h-[44px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="Combed">Combed</SelectItem>
          <SelectItem value="Carded">Carded</SelectItem>
        </SelectContent>
      </Select>

      <Input
        placeholder="Fiber"
        defaultValue={searchParams.get('fiber') ?? ''}
        className="w-36 min-h-[44px]"
        onChange={(e) => updateParam('fiber', e.target.value)}
      />

      <Input
        placeholder="Lot"
        defaultValue={searchParams.get('lot') ?? ''}
        className="w-36 min-h-[44px]"
        onChange={(e) => updateParam('lot', e.target.value)}
      />

      {hasFilters && (
        <Button
          variant="ghost"
          className="min-h-[44px]"
          onClick={() => router.push(pathname)}
        >
          Clear filters
        </Button>
      )}
    </div>
  )
}
