'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowUp, ArrowDown, Trash2, Plus, Heading, Calculator, Rows3, Minus, Eye, Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { saveCustomReportAction } from '@/app/actions/save-custom-report'
import type { Basis, LineType, ReportDefinition, Sign } from '@/lib/reports/custom-report'
import { AccountMultiPicker, type PickerAccount } from './account-multi-picker'
import { cn } from '@/lib/utils'

type DraftLine = {
  uid: string
  lineType: LineType
  label: string
  ref: string
  indent: number
  sign: Sign
  includeChildren: boolean
  showDetail: boolean
  isBold: boolean
  underline: boolean
  formula: string
  accountCodes: string[]
}

const LINE_TYPE_META: Record<LineType, { label: string; hint: string; icon: typeof Heading }> = {
  header:   { label: 'Section heading', hint: 'A caption only — prints no amount.', icon: Heading },
  accounts: { label: 'Reporting header', hint: 'Totals the account codes mapped to it.', icon: Rows3 },
  subtotal: { label: 'Subtotal / calculation', hint: 'Adds and subtracts other lines by their reference.', icon: Calculator },
  spacer:   { label: 'Blank line', hint: 'Visual spacing.', icon: Minus },
}

let uidCounter = 0
const nextUid = () => `draft-${uidCounter++}`

function blankLine(lineType: LineType): DraftLine {
  return {
    uid: nextUid(),
    lineType,
    label: lineType === 'spacer' ? '' : '',
    ref: '',
    indent: lineType === 'accounts' ? 1 : 0,
    sign: 'natural',
    includeChildren: true,
    showDetail: false,
    isBold: lineType === 'subtotal',
    underline: lineType === 'subtotal',
    formula: '',
    accountCodes: [],
  }
}

export function ReportBuilder({
  definition, accounts,
}: { definition: ReportDefinition; accounts: PickerAccount[] }) {
  const router = useRouter()
  const [name, setName] = useState(definition.name)
  const [description, setDescription] = useState(definition.description ?? '')
  const [basis, setBasis] = useState<Basis>(definition.basis)
  const [hideZeroRows, setHideZeroRows] = useState(definition.hideZeroRows)
  const [lines, setLines] = useState<DraftLine[]>(() =>
    definition.lines.map((l) => ({
      uid: nextUid(),
      lineType: l.lineType,
      label: l.label,
      ref: l.ref ?? '',
      indent: l.indent,
      sign: l.sign,
      includeChildren: l.includeChildren,
      showDetail: l.showDetail,
      isBold: l.isBold,
      underline: l.underline,
      formula: l.formula ?? '',
      accountCodes: l.accountCodes,
    }))
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const patch = (uid: string, changes: Partial<DraftLine>) => {
    setSaved(false)
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...changes } : l)))
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= lines.length) return
    setSaved(false)
    setLines((prev) => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const remove = (uid: string) => {
    setSaved(false)
    setLines((prev) => prev.filter((l) => l.uid !== uid))
  }

  const add = (lineType: LineType) => {
    setSaved(false)
    setLines((prev) => [...prev, blankLine(lineType)])
  }

  const save = (thenView: boolean) => {
    startTransition(async () => {
      setError(null)
      const result = await saveCustomReportAction({
        id: definition.id,
        name,
        description: description.trim() || undefined,
        basis,
        hideZeroRows,
        lines: lines.map((l) => ({
          lineType: l.lineType,
          label: l.label.trim(),
          ref: l.ref.trim() || undefined,
          indent: l.indent,
          sign: l.sign,
          includeChildren: l.includeChildren,
          showDetail: l.showDetail,
          isBold: l.isBold,
          underline: l.underline,
          formula: l.formula.trim() || undefined,
          accountCodes: l.accountCodes,
        })),
      })
      if (!result.success) { setError(result.error); return }
      if (thenView) { router.push(`/reports/custom/${definition.id}`); return }
      setSaved(true)
      router.refresh()
    })
  }

  // Refs a formula on a given line may use — those defined ABOVE it, matching
  // how the engine evaluates top to bottom.
  const refsAbove = (index: number) =>
    lines.slice(0, index).map((l) => l.ref.trim().toUpperCase()).filter(Boolean)

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Report settings ---- */}
      <div className="bg-card rounded-2xl border shadow-sm p-4 flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs mb-1 block">Report Name</Label>
            <Input value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} className="min-h-[44px]" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Reporting Basis</Label>
            <Select value={basis} onValueChange={(v) => { setBasis(v as Basis); setSaved(false) }}>
              <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="period">Date range — movement between two dates (P&amp;L style)</SelectItem>
                <SelectItem value="as_of">As of date — cumulative balances (Balance Sheet style)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs mb-1 block">Description</Label>
          <Textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); setSaved(false) }}
            rows={2}
            placeholder="Optional — shown under the report title."
          />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={hideZeroRows} onCheckedChange={(c) => { setHideZeroRows(c === true); setSaved(false) }} />
          Hide lines that come out zero for the selected period
        </label>
      </div>

      {/* ---- Lines ---- */}
      <div className="flex flex-col gap-3">
        {lines.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No lines yet. Add a section heading, then a reporting header beneath it.
          </div>
        )}

        {lines.map((line, index) => {
          const meta = LINE_TYPE_META[line.lineType]
          const Icon = meta.icon
          const available = refsAbove(index)

          return (
            <div key={line.uid} className="bg-card rounded-2xl border shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={line.lineType} onValueChange={(v) => patch(line.uid, { lineType: v as LineType })}>
                  <SelectTrigger className="h-8 w-[210px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LINE_TYPE_META) as LineType[]).map((t) => (
                      <SelectItem key={t} value={t}>{LINE_TYPE_META[t].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground hidden sm:inline">{meta.hint}</span>

                <div className="ml-auto flex items-center gap-0.5">
                  <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
                          onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
                          onClick={() => move(index, 1)} disabled={index === lines.length - 1} aria-label="Move down">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => remove(line.uid)} aria-label="Delete line">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {line.lineType === 'spacer' ? (
                <div className="px-4 py-3 text-xs text-muted-foreground">Prints an empty row.</div>
              ) : (
                <div className="p-4 flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_110px_110px]">
                    <div>
                      <Label className="text-xs mb-1 block">Reporting Header</Label>
                      <Input
                        value={line.label}
                        onChange={(e) => patch(line.uid, { label: e.target.value })}
                        placeholder={line.lineType === 'header' ? 'e.g. REVENUE' : 'e.g. Sales Revenue'}
                        className="min-h-[40px]"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block" title="Short handle a subtotal can refer to">
                        Reference
                      </Label>
                      <Input
                        value={line.ref}
                        onChange={(e) => patch(line.uid, { ref: e.target.value.toUpperCase() })}
                        placeholder="REV"
                        className="min-h-[40px] font-mono text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Indent</Label>
                      <Select value={String(line.indent)} onValueChange={(v) => patch(line.uid, { indent: Number(v) })}>
                        <SelectTrigger className="min-h-[40px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[0, 1, 2, 3, 4].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n === 0 ? 'None' : `Level ${n}`}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {line.lineType === 'accounts' && (
                    <>
                      <div>
                        <Label className="text-xs mb-1.5 block">Account Codes</Label>
                        <AccountMultiPicker
                          accounts={accounts}
                          value={line.accountCodes}
                          onChange={(codes) => patch(line.uid, { accountCodes: codes })}
                          includeChildren={line.includeChildren}
                        />
                      </div>

                      <div>
                        <Label className="text-xs mb-1.5 block">Behaviour</Label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <Select value={line.sign} onValueChange={(v) => patch(line.uid, { sign: v as Sign })}>
                              <SelectTrigger className="min-h-[40px] text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="natural">
                                  Debit balances positive — assets, expenses
                                </SelectItem>
                                <SelectItem value="credit_positive">
                                  Credit balances positive — revenue, liabilities, equity
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={line.includeChildren}
                              onCheckedChange={(c) => patch(line.uid, { includeChildren: c === true })}
                            />
                            Roll up child accounts
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={line.showDetail}
                              onCheckedChange={(c) => patch(line.uid, { showDetail: c === true })}
                            />
                            List each account below
                          </label>
                        </div>
                      </div>
                    </>
                  )}

                  {line.lineType === 'subtotal' && (
                    <div>
                      <Label className="text-xs mb-1 block">Formula</Label>
                      <Input
                        value={line.formula}
                        onChange={(e) => patch(line.uid, { formula: e.target.value.toUpperCase() })}
                        placeholder="REV - COGS"
                        className="min-h-[40px] font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1.5">
                        <Info className="h-3 w-3 mt-0.5 shrink-0" />
                        {available.length > 0
                          ? <span>Available references above this line: <span className="font-mono">{available.join(', ')}</span>. Combine with + and −.</span>
                          : <span>Give the lines above a <strong>Reference</strong> first, then name them here.</span>}
                      </p>
                    </div>
                  )}

                  {line.lineType !== 'header' && (
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={line.isBold} onCheckedChange={(c) => patch(line.uid, { isBold: c === true })} />
                        Bold
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={line.underline} onCheckedChange={(c) => patch(line.uid, { underline: c === true })} />
                        Rule above the amount
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ---- Add / save ---- */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LINE_TYPE_META) as LineType[]).map((t) => (
          <Button key={t} type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => add(t)}>
            <Plus className="h-3.5 w-3.5" /> {LINE_TYPE_META[t].label}
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className={cn(
        'sticky bottom-0 -mx-6 px-6 py-3 border-t bg-background/95 backdrop-blur flex items-center gap-2',
      )}>
        <Button onClick={() => save(false)} disabled={isPending} className="min-h-[44px]">
          {isPending ? 'Saving…' : saved ? 'Saved' : 'Save Layout'}
        </Button>
        <Button onClick={() => save(true)} disabled={isPending} variant="outline" className="min-h-[44px] gap-2">
          <Eye className="h-4 w-4" /> Save &amp; View
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{lines.length} line{lines.length === 1 ? '' : 's'}</span>
      </div>
    </div>
  )
}
