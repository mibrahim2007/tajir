'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { POSTING_PROCESSES, type PostingProcess } from '@/lib/accounting/posting-rules'
import { savePostingAccountsAction } from '@/app/actions/save-posting-accounts'

export type PostingAccount = {
  id: string
  code: string
  name: string
  type: string
  systemKey: string | null
  active: boolean
}

const STANDARD = '__standard'
const GROUPS: PostingProcess['group'][] = ['Sales', 'Purchases', 'Money', 'People']

const rowKey = (process: string, systemKey: string) => `${process}:${systemKey}`

export function PostingAccountsForm({ accounts, overrides }: { accounts: PostingAccount[]; overrides: Record<string, string> }) {
  const router = useRouter()
  const [value, setValue] = useState<Record<string, string>>(overrides)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const standardByKey = useMemo(() => new Map(accounts.filter((a) => a.systemKey).map((a) => [a.systemKey!, a])), [accounts])
  const byId          = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const changedCount = Object.keys(value).length
  const dirty = JSON.stringify(Object.entries(value).sort()) !== JSON.stringify(Object.entries(overrides).sort())

  const set = (k: string, accountId: string) => {
    setSaved(false)
    setError(null)
    setValue((v) => {
      const next = { ...v }
      if (accountId === STANDARD) delete next[k]
      else next[k] = accountId
      return next
    })
  }

  const resetProcess = (p: PostingProcess) => {
    setSaved(false)
    setValue((v) => Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith(`${p.process}:`))))
  }

  const save = () => {
    startTransition(async () => {
      setError(null)
      const payload = Object.entries(value).map(([k, accountId]) => {
        const [process, systemKey] = k.split(':')
        return { process, systemKey, accountId }
      })
      const result = await savePostingAccountsAction({ overrides: payload })
      if (!result.success) { setError(result.error); return }
      setSaved(true)
      router.refresh()
    })
  }

  const fmt = (a: PostingAccount | undefined) => (a ? `${a.code} · ${a.name}` : '—')

  return (
    <div className="space-y-8">
      {GROUPS.map((group) => (
        <section key={group}>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">{group}</h2>
          <div className="space-y-4">
            {POSTING_PROCESSES.filter((p) => p.group === group).map((p) => {
              const changedHere = p.heads.filter((h) => value[rowKey(p.process, h.systemKey)]).length
              return (
                <div key={p.process} className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b bg-muted/30">
                    <div>
                      <p className="font-semibold">{p.label}</p>
                      {p.chosenOnForm && (
                        <p className="text-xs text-muted-foreground">{p.chosenOnForm} — chosen on the form</p>
                      )}
                    </div>
                    {changedHere > 0 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => resetProcess(p)}>
                        Reset to standard
                      </Button>
                    )}
                  </div>
                  <div className="divide-y">
                    {p.heads.map((h) => {
                      const k        = rowKey(p.process, h.systemKey)
                      const standard = standardByKey.get(h.systemKey)
                      const current  = value[k]
                      const options  = standard
                        ? accounts.filter((a) => a.type === standard.type && a.active && a.id !== standard.id)
                        : []
                      return (
                        <div key={k} className="grid grid-cols-1 sm:grid-cols-[3.5rem_1fr_minmax(0,21rem)] gap-x-3 gap-y-1.5 px-4 py-3 sm:items-center">
                          <span className={`text-xs font-bold ${h.side === 'Cr' ? 'text-sky-700 dark:text-sky-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                            {h.side}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm">{h.purpose}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              Standard: {standard ? fmt(standard) : <span className="text-destructive">missing from chart of accounts</span>}
                            </p>
                          </div>
                          <Select value={current ?? STANDARD} onValueChange={(v) => set(k, v)} disabled={!standard}>
                            <SelectTrigger className={`w-full min-h-[44px] [&>span]:truncate ${current ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : ''}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={STANDARD}>Standard — {fmt(standard)}</SelectItem>
                              {options.map((a) => <SelectItem key={a.id} value={a.id}>{fmt(a)}</SelectItem>)}
                              {/* An override whose account was since deactivated still needs a label. */}
                              {current && !options.some((a) => a.id === current) && (
                                <SelectItem value={current}>{fmt(byId.get(current))} (inactive)</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {/* Sticky so Save stays in reach while scrolling through every process. */}
      <div className="sticky bottom-0 z-20 -mx-4 sm:-mx-6 border-t bg-background/95 backdrop-blur px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center justify-end gap-3">
          {error && <p className="text-sm text-destructive mr-auto">{error}</p>}
          {!error && saved && !dirty && <p className="text-sm text-emerald-700 dark:text-emerald-400 mr-auto">Saved.</p>}
          {!error && !saved && (
            <p className="text-sm text-muted-foreground mr-auto">
              {changedCount === 0 ? 'All heads on standard accounts' : `${changedCount} head${changedCount !== 1 ? 's' : ''} changed from standard`}
            </p>
          )}
          {changedCount > 0 && (
            <Button type="button" variant="outline" className="min-h-[44px]" disabled={isPending} onClick={() => { setSaved(false); setValue({}) }}>
              Reset all
            </Button>
          )}
          <Button type="button" className="min-h-[44px]" disabled={isPending || !dirty} onClick={save}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
