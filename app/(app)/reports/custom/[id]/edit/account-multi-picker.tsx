'use client'

import { useMemo, useState } from 'react'
import { Search, Check, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type PickerAccount = {
  code: string
  name: string
  account_type: string
  parent_code: string | null
  is_header: boolean
}

const TYPE_LABELS: Record<string, string> = {
  asset: 'Asset', liability: 'Liability', equity: 'Equity', revenue: 'Revenue', expense: 'Expense',
}

/**
 * Multi-select over the chart of accounts.
 *
 * Header accounts are selectable on purpose — picking "4000 REVENUE" with
 * roll-up on is the whole point of the feature, and is far more durable than
 * ticking today's leaf accounts one by one.
 */
export function AccountMultiPicker({
  accounts, value, onChange, includeChildren,
}: {
  accounts: PickerAccount[]
  value: string[]
  onChange: (codes: string[]) => void
  includeChildren: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const byCode = useMemo(() => new Map(accounts.map((a) => [a.code, a])), [accounts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter((a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
  }, [accounts, search])

  const toggle = (code: string) => {
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code])
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.length === 0 && (
          <span className="text-xs text-muted-foreground">No accounts mapped yet</span>
        )}
        {value.map((code) => {
          const acc = byCode.get(code)
          return (
            <span
              key={code}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs',
                acc ? 'bg-secondary' : 'bg-destructive/10 border-destructive text-destructive',
              )}
              title={acc ? acc.name : 'This code is no longer in the chart of accounts'}
            >
              <span className="font-mono">{code}</span>
              <span className="max-w-[140px] truncate">{acc?.name ?? 'unknown account'}</span>
              {acc?.is_header && includeChildren && (
                <span className="opacity-60">+ children</span>
              )}
              <button
                type="button"
                onClick={() => toggle(code)}
                className="opacity-60 hover:opacity-100"
                aria-label={`Remove ${code}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )
        })}
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="h-7 gap-1">
          <Plus className="h-3 w-3" /> Accounts
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch('') }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Accounts</DialogTitle>
            <DialogDescription>
              {includeChildren
                ? 'Child accounts roll up automatically — selecting a heading covers everything beneath it.'
                : 'Roll-up is off for this line, so only the exact accounts you tick are counted.'}
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code or name…"
              className="pl-9 min-h-[44px]"
            />
          </div>

          <div className="max-h-[50vh] overflow-y-auto -mx-6 px-6">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No matching accounts.</p>
            ) : (
              <div className="divide-y">
                {filtered.map((a) => {
                  const selected = value.includes(a.code)
                  return (
                    <button
                      key={a.code}
                      type="button"
                      onClick={() => toggle(a.code)}
                      className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-secondary/50 px-2 -mx-2 rounded"
                    >
                      <span className={cn(
                        'h-4 w-4 rounded border flex items-center justify-center shrink-0',
                        selected ? 'bg-primary border-primary text-primary-foreground' : 'border-input',
                      )}>
                        {selected && <Check className="h-3 w-3" />}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground w-14 shrink-0">{a.code}</span>
                      <span className={cn('text-sm truncate', a.is_header && 'font-semibold')}>{a.name}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
                        {a.is_header ? 'heading' : TYPE_LABELS[a.account_type] ?? a.account_type}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground">{value.length} selected</span>
            <Button type="button" onClick={() => setOpen(false)} className="min-h-[44px]">Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
