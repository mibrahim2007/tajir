'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { filterCheques } from '@/lib/pdc/search'
import { formatPKR } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import type { EndorsableCheque } from '@/components/tender-lines-field'

export const NEW_CHEQUE = '__new__'
export const chequeKey = (c: { source: string; lineId: string }) => `${c.source}:${c.lineId}`

/**
 * Below this there is nothing to search — one cheque or none.
 *
 * Deliberately low: cheque numbers are long and look alike, so picking the
 * right one is hard well before the list gets long.
 */
const SEARCH_THRESHOLD = 2

/** Label shown on the closed trigger. */
function labelFor(value: string, cheques: EndorsableCheque[]): string {
  if (value === NEW_CHEQUE) return 'Write a new cheque'
  const c = cheques.find((x) => chequeKey(x) === value)
  if (!c) return 'Select a cheque…'
  return `${c.chequeNumber ?? '—'}${c.partyName ? ` · ${c.partyName}` : ''} · ${formatPKR(c.amount)}`
}

/**
 * Picks a received cheque to hand on, or "write a new one".
 *
 * Built on a dialog rather than a Select on purpose. A Select owns keyboard
 * focus so it can run its own type-to-jump, which means a search box inside its
 * panel never receives the keystrokes — the box appears to work and silently
 * does nothing. The command palette already solves this shape in this codebase,
 * so this follows it: focus goes to the input, the list is filtered text, and
 * arrow keys move a highlight that Enter commits.
 */
export function ChequePicker({
  value,
  onValueChange,
  cheques,
}: {
  /** chequeKey(...) of the endorsed cheque, or NEW_CHEQUE. */
  value: string
  onValueChange: (value: string) => void
  cheques: EndorsableCheque[]
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const showSearch = cheques.length >= SEARCH_THRESHOLD

  const visible = useMemo(() => filterCheques(cheques, query), [cheques, query])

  // "Write a new cheque" is always reachable, and is the first row so that an
  // empty search still opens on the escape hatch rather than a random cheque.
  const rows = useMemo(
    () => [{ key: NEW_CHEQUE, label: 'Write a new cheque', cheque: null as EndorsableCheque | null },
      ...visible.map((c) => ({ key: chequeKey(c), label: labelFor(chequeKey(c), cheques), cheque: c }))],
    [visible, cheques],
  )

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIdx(0)
    const t = setTimeout(() => inputRef.current?.focus(), 10)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => { setActiveIdx(0) }, [query])

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${activeIdx}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const commit = (key: string) => {
    onValueChange(key)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, rows.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (rows[activeIdx]) commit(rows[activeIdx].key) }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label="Choose a cheque"
        className="flex min-h-[44px] w-full min-w-0 items-center justify-between gap-1 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:min-h-[40px]"
      >
        <span className="min-w-0 truncate text-left">{labelFor(value, cheques)}</span>
        <ChevronDown className="size-4 shrink-0 opacity-50" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg overflow-hidden p-0" showCloseButton={false}>
          <DialogTitle className="sr-only">Choose a cheque</DialogTitle>

          {showSearch && (
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search number, party, amount…"
                aria-label="Search cheques"
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}

          <div ref={listRef} className="max-h-[320px] overflow-y-auto p-1" onKeyDown={onKeyDown}>
            {rows.map((r, idx) => (
              <button
                key={r.key}
                type="button"
                data-idx={idx}
                onClick={() => commit(r.key)}
                onMouseEnter={() => setActiveIdx(idx)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-left text-sm',
                  idx === activeIdx && 'bg-accent text-accent-foreground',
                  r.key === value && 'font-medium',
                )}
              >
                <span className="min-w-0 truncate">{r.label}</span>
                {r.cheque?.dueDate && (
                  <span className="shrink-0 text-xs text-muted-foreground">due {r.cheque.dueDate}</span>
                )}
              </button>
            ))}

            {query && visible.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No cheque matches “{query}”.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
