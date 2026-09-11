'use client'

import { useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Check, AlertCircle, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ActionResult } from '@/lib/types'

/* ── Step chrome ─────────────────────────────────────────────────────────── */

export function StepHeader({
  icon: Icon,
  title,
  description,
  href,
  hrefLabel,
}: {
  icon: React.ElementType
  title: string
  description: ReactNode
  href?: string
  hrefLabel?: string
}) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <span className="icon-chip icon-chip-cyan h-12 w-12 rounded-2xl shrink-0">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
      {href && (
        <Link
          href={href}
          className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline shrink-0 mt-1"
        >
          {hrefLabel ?? 'Open full page'} <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}

/** A short "why this matters" callout beneath the header. */
export function Why({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[13px] leading-relaxed text-foreground/90 mb-5">
      {children}
    </div>
  )
}

/**
 * What the tenant already has for this step. Keeps the wizard honest on a
 * second visit — nothing is re-created, and the user can see the names
 * without leaving to the full list.
 */
export function AlreadyHave({
  label,
  names,
  total,
  href,
}: {
  label: string
  names: string[]
  total: number
  href: string
}) {
  if (total === 0) return null
  const more = total - names.length
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {label} already in Tajir · {total}
        </p>
        <Link href={href} className="text-[11px] font-semibold text-primary hover:underline">Manage →</Link>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {names.map((n) => (
          <span key={n} className="inline-flex items-center gap-1 rounded-full border border-border bg-tile/60 px-2.5 py-1 text-xs font-medium">
            <Check className="h-3 w-3 text-emerald-500" /> {n}
          </span>
        ))}
        {more > 0 && (
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs text-muted-foreground">+{more} more</span>
        )}
      </div>
    </div>
  )
}

/* ── Multi-row draft editing ────────────────────────────────────────────── */

export type DraftRow<T> = T & { _key: number; _error?: string }

let keySeq = 1

/**
 * A small draft grid. The wizard's whole point is entering ten customers in
 * one go rather than opening a sheet ten times, so every list step shares
 * this: rows live locally, "Save" runs the real create action per row, rows
 * that succeed disappear, rows that fail stay put with their message.
 */
export function useDraftRows<T extends object>(blank: () => T, initialCount = 3) {
  const [rows, setRows] = useState<DraftRow<T>[]>(() =>
    Array.from({ length: initialCount }, () => ({ ...blank(), _key: keySeq++ })),
  )
  const add = () => setRows((r) => [...r, { ...blank(), _key: keySeq++ }])
  const remove = (key: number) => setRows((r) => (r.length > 1 ? r.filter((x) => x._key !== key) : r))
  const update = (key: number, patch: Partial<T>) =>
    setRows((r) => r.map((x) => (x._key === key ? { ...x, ...patch, _error: undefined } : x)))
  return { rows, setRows, add, remove, update }
}

type SaveRowsArgs<T> = {
  rows: DraftRow<T>[]
  setRows: React.Dispatch<React.SetStateAction<DraftRow<T>[]>>
  /** True when the row carries nothing worth saving — silently dropped. */
  isBlank: (row: T) => boolean
  /** A message when a non-blank row can't be saved yet, else null. */
  validate: (row: T) => string | null
  create: (row: T) => Promise<ActionResult<unknown>>
  blank: () => T
}

/**
 * Save-all button with per-row outcome. Sequential rather than parallel so a
 * duplicate-name error names the second row, not a random one.
 */
export function SaveRowsButton<T extends object>({
  label,
  savedLabel,
  args,
  disabled,
}: {
  label: string
  savedLabel: (n: number) => string
  args: SaveRowsArgs<T>
  disabled?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)

  const filled = args.rows.filter((r) => !args.isBlank(r)).length

  const save = () => {
    setNotice(null)
    // Validate everything first so the user fixes all the red rows at once.
    let invalid = 0
    const validated = args.rows.map((r) => {
      if (args.isBlank(r)) return r
      const err = args.validate(r)
      if (err) invalid++
      return { ...r, _error: err ?? undefined }
    })
    args.setRows(validated)
    if (invalid > 0) {
      setNotice({ tone: 'warn', text: `${invalid} row${invalid > 1 ? 's need' : ' needs'} attention before saving.` })
      return
    }

    startTransition(async () => {
      let saved = 0
      const remaining: DraftRow<T>[] = []
      for (const r of validated) {
        if (args.isBlank(r)) continue
        const res = await args.create(r)
        if (res.success) saved++
        else remaining.push({ ...r, _error: res.error })
      }
      // Leave one empty row so the grid never collapses to nothing.
      args.setRows(remaining.length > 0 ? remaining : [{ ...args.blank(), _key: keySeq++ }])
      if (remaining.length === 0) setNotice({ tone: 'ok', text: savedLabel(saved) })
      else setNotice({ tone: 'warn', text: `${savedLabel(saved)} ${remaining.length} could not be saved — see the rows above.` })
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
      <Button type="button" onClick={save} disabled={disabled || isPending || filled === 0} className="min-h-[44px] sm:min-w-[180px]">
        {isPending ? 'Saving…' : filled > 0 ? `${label} (${filled})` : label}
      </Button>
      {notice && (
        <p className={cn('text-sm flex items-center gap-1.5', notice.tone === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
          {notice.tone === 'ok' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {notice.text}
        </p>
      )}
    </div>
  )
}

/** The grid frame: header row + body + "add row" footer. */
export function DraftGrid({
  columns,
  children,
  onAdd,
  addLabel = 'Add row',
  minWidth = 640,
}: {
  columns: { label: string; width?: string; required?: boolean; right?: boolean }[]
  children: ReactNode
  onAdd: () => void
  addLabel?: string
  minWidth?: number
}) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.label}
                  style={c.width ? { width: c.width } : undefined}
                  className={cn(
                    'px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap',
                    c.right ? 'text-right' : 'text-left',
                  )}
                >
                  {c.label}
                  {c.required && <span className="text-destructive ml-0.5">*</span>}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">{children}</tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-primary hover:bg-secondary/60 transition-colors border-t border-border"
      >
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </button>
    </div>
  )
}

export function DraftRowShell({
  error,
  onRemove,
  children,
}: {
  error?: string
  onRemove: () => void
  children: ReactNode
}) {
  return (
    <>
      <tr className={cn('align-top', error && 'bg-destructive/5')}>
        {children}
        <td className="px-2 py-2">
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive p-1.5 rounded-md mt-0.5"
            title="Remove row"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </td>
      </tr>
      {error && (
        <tr className="bg-destructive/5">
          <td colSpan={99} className="px-3 pb-2 pt-0 text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </td>
        </tr>
      )}
    </>
  )
}

export const cellInput =
  'flex h-10 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground/60'

export function Cell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-1.5 py-1.5', className)}>{children}</td>
}

/** Enter moves to the next input in the grid, like a spreadsheet. */
export function enterToNext(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Enter') return
  e.preventDefault()
  const form = (e.currentTarget as HTMLElement).closest('table')
  if (!form) return
  const fields = Array.from(form.querySelectorAll<HTMLElement>('input, select, [role="combobox"]'))
  const i = fields.indexOf(e.currentTarget as HTMLElement)
  fields[i + 1]?.focus()
}
