'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Account = { id: string; code: string; name: string }

export function CashbookFilters({
  date,
  accountId,
  accounts,
}: {
  date: string
  accountId: string
  accounts: Account[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const update = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams.toString())
    if (value) p.set(key, value)
    else p.delete(key)
    router.push(`?${p.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-end gap-4 mb-4 print:hidden">
      <div>
        <Label className="text-xs mb-1 block">Date</Label>
        <Input
          type="date"
          defaultValue={date}
          className="min-h-[44px] w-40"
          onChange={(e) => update('date', e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs mb-1 block">Cash / Bank Account</Label>
        <Select
          defaultValue={accountId || '_all'}
          onValueChange={(v) => update('accountId', v === '_all' ? '' : v)}
        >
          <SelectTrigger className="min-h-[44px] w-56">
            <SelectValue placeholder="All Cash & Bank" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Cash &amp; Bank</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.code} — {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
