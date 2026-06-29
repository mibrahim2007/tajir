'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Bank = { id: string; name: string; account_number: string | null }

export function BankStatementFilters({
  bankId,
  from,
  to,
  banks,
}: {
  bankId: string
  from: string
  to: string
  banks: Bank[]
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
        <Label className="text-xs mb-1 block">Bank <span className="text-destructive">*</span></Label>
        <Select defaultValue={bankId || '_none'} onValueChange={(v) => update('bankId', v === '_none' ? '' : v)}>
          <SelectTrigger className="min-h-[44px] w-56">
            <SelectValue placeholder="Select bank…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">— Select bank —</SelectItem>
            {banks.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}{b.account_number ? ` — ${b.account_number}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs mb-1 block">From</Label>
        <Input
          type="date"
          defaultValue={from}
          className="min-h-[44px] w-40"
          onChange={(e) => update('from', e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs mb-1 block">To</Label>
        <Input
          type="date"
          defaultValue={to}
          className="min-h-[44px] w-40"
          onChange={(e) => update('to', e.target.value)}
        />
      </div>
    </div>
  )
}
