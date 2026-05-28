'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Account = { id: string; code: string; name: string; account_type: string }

type Props = {
  from: string
  to: string
  accountId: string
  accounts: Account[]
}

const TYPE_ORDER = ['asset', 'liability', 'equity', 'revenue', 'expense']
const TYPE_LABELS: Record<string, string> = {
  asset: 'Assets', liability: 'Liabilities', equity: 'Equity', revenue: 'Revenue', expense: 'Expenses',
}

export function GeneralLedgerFilters({ from, to, accountId, accounts }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const update = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams.toString())
    if (value) p.set(key, value); else p.delete(key)
    router.push(`?${p.toString()}`)
  }

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    items: accounts.filter((a) => a.account_type === type),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="flex flex-wrap items-end gap-4 mb-4 print:hidden">
      <div>
        <Label className="text-xs mb-1 block">From</Label>
        <Input
          type="date" defaultValue={from} className="min-h-[40px] w-36"
          onChange={(e) => update('from', e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs mb-1 block">To</Label>
        <Input
          type="date" defaultValue={to} className="min-h-[40px] w-36"
          onChange={(e) => update('to', e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs mb-1 block">Account (optional)</Label>
        <Select value={accountId} onValueChange={(v) => update('accountId', v === 'all' ? '' : v)}>
          <SelectTrigger className="min-h-[40px] w-64">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {grouped.map((g) => (
              <div key={g.type}>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {g.label}
                </div>
                {g.items.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    <span className="font-mono text-muted-foreground mr-2">{a.code}</span>{a.name}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
