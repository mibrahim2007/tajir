'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// A 'period' report needs two dates; an 'as_of' report needs only the closing
// date, so showing a From box there would imply a filter that is ignored.
export function CustomReportFilters({ basis, from, to }: { basis: 'period' | 'as_of'; from: string; to: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const update = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams.toString())
    if (value) p.set(key, value); else p.delete(key)
    router.push(`?${p.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-end gap-4 mb-4 print:hidden">
      {basis === 'period' && (
        <div>
          <Label className="text-xs mb-1 block">From</Label>
          <Input
            type="date" defaultValue={from} className="min-h-[44px] w-36"
            onChange={(e) => update('from', e.target.value)}
          />
        </div>
      )}
      <div>
        <Label className="text-xs mb-1 block">{basis === 'period' ? 'To' : 'As of Date'}</Label>
        <Input
          type="date" defaultValue={to} className="min-h-[44px] w-36"
          onChange={(e) => update('to', e.target.value)}
        />
      </div>
    </div>
  )
}
