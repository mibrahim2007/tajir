'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function TrialBalanceFilters({ asOf }: { asOf: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const update = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set(key, value)
    router.push(`?${p.toString()}`)
  }

  return (
    <div className="flex items-end gap-4 mb-4 print:hidden">
      <div>
        <Label className="text-xs mb-1 block">As of Date</Label>
        <Input
          type="date"
          defaultValue={asOf}
          className="min-h-[40px] w-40"
          onChange={(e) => update('asOf', e.target.value)}
        />
      </div>
    </div>
  )
}
