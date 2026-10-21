'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GradeSelect } from '@/components/grade-select'
import { setStockOpeningBalances } from '@/app/actions/set-opening-balance'
import type { GradeOption } from '@/app/actions/grades'
import { cartonStockQty, needsWeight, usesCartons } from '@/lib/item-formula'
import { openingLineKey } from '@/lib/inventory/opening-stock'
import type { ItemProfile } from '@/lib/inventory/item-profiles'
import type { OpeningLot, LocationOption } from './stock-balance-table'

const RETURN_PATH = '/settings/opening-balances'

/** A line being edited. `key` only exists to keep React rows stable. */
type DraftLine = {
  key: number; locationId: string; quantity: string; rate: string
  gradeId: string | null; lotNo: string; nosCarton: string; weightPerCarton: string
}

function fmtPKR(n: number) {
  return n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const blankLine = (key: number, profile: ItemProfile): DraftLine => ({
  key, locationId: '', quantity: '', rate: '', gradeId: null, lotNo: '', nosCarton: '',
  weightPerCarton: profile.stdPackWeight ? String(profile.stdPackWeight) : '',
})

function toDraft(lot: OpeningLot, profile: ItemProfile): DraftLine[] {
  if (lot.lines.length === 0) return [blankLine(0, profile)]
  return lot.lines.map((l, i) => ({
    key: i,
    locationId: l.locationId,
    quantity: String(l.quantity),
    rate: String(l.rate),
    gradeId: l.gradeId ?? null,
    lotNo: l.lotNo ?? '',
    nosCarton: l.nosCarton == null ? '' : String(l.nosCarton),
    weightPerCarton: l.weightPerCarton == null ? '' : String(l.weightPerCarton),
  }))
}

type Props = {
  lot: OpeningLot
  locations: LocationOption[]
  grades: GradeOption[]
  /** The item type's formula profile: carton fields, grade and lot tracking. */
  profile: ItemProfile
}

// Full-page form at /settings/opening-balances/stock/[id]/edit (was a drawer on
// Opening Balances).
export function StockOpeningForm({ lot, locations, grades: initialGrades, profile }: Props) {
  const router = useRouter()
  const [lines, setLines] = useState<DraftLine[]>(() => toDraft(lot, profile))
  const [grades, setGrades] = useState<GradeOption[]>(initialGrades)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const carton = usesCartons(profile.formula)
  const unit = profile.stockUnit || 'unit'
  const num = (v: string) => parseFloat(v) || 0
  // Carton formulas derive the stock quantity (cartons × kg; per pack: packs).
  const qtyOf = (l: DraftLine) =>
    carton ? (cartonStockQty(profile.formula, { nosCarton: num(l.nosCarton), weightPerCarton: num(l.weightPerCarton) }) ?? 0) : num(l.quantity)

  const setLine = (key: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const addLine = () =>
    setLines((prev) => [...prev, blankLine(Math.max(-1, ...prev.map((l) => l.key)) + 1, profile)])

  const removeLine = (key: number) => setLines((prev) => prev.filter((l) => l.key !== key))

  const totalQty   = lines.reduce((s, l) => s + qtyOf(l), 0)
  const totalValue = lines.reduce((s, l) => s + qtyOf(l) * num(l.rate), 0)
  const usedLocations = new Set(lines.filter((l) => l.locationId).map((l) => l.locationId)).size

  const save = () => {
    // Blank rows are how a user backs out of a line they added by mistake, so
    // drop them rather than making them fix it.
    const filled = lines.filter((l) => l.locationId || l.quantity || l.rate || l.nosCarton)

    if (filled.some((l) => !l.locationId)) { setError('Pick a location for every line'); return }
    if (profile.trackGrade && filled.some((l) => !l.gradeId && (qtyOf(l) > 0 || num(l.rate) > 0))) {
      setError('Pick a grade for every line'); return
    }

    // A tracked lot left blank gets its own generated number on save.
    const keys = filled.map((l) => openingLineKey({
      locationId: l.locationId,
      gradeId: l.gradeId,
      lotNo: l.lotNo.trim() || (profile.trackLot ? `#auto-${l.key}` : ''),
    }))
    if (new Set(keys).size !== keys.length) { setError('Each location, grade and lot can only be listed once'); return }

    startTransition(async () => {
      setError(null)
      const result = await setStockOpeningBalances({
        lotId: lot.id,
        lines: filled.map((l) => ({
          locationId: l.locationId,
          quantity: qtyOf(l),
          rate: num(l.rate),
          gradeId: profile.trackGrade ? l.gradeId : null,
          lotNo: profile.trackLot ? (l.lotNo.trim() || null) : null,
          nosCarton: carton && l.nosCarton !== '' ? num(l.nosCarton) : undefined,
          weightPerCarton: carton && l.weightPerCarton !== '' ? num(l.weightPerCarton) : undefined,
        })),
      })
      if (!result.success) { setError(result.error); return }
      // Back to Opening Balances, which re-renders with the new figures. No
      // router.refresh() inside the transition — it keeps isPending stuck.
      router.push(RETURN_PATH)
    })
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

      {/* ── FORM (left on xl) ── */}
      <Card className="min-w-0">
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="text-base">Opening Stock by Location</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          {locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add a location under Inventory → Locations first.</p>
          ) : (
            <>
              <div className="space-y-3">
                {lines.map((line) => {
                  // Without grade / lot a location can only appear once.
                  const takenElsewhere = profile.trackGrade || profile.trackLot
                    ? new Set<string>()
                    : new Set(lines.filter((l) => l.key !== line.key).map((l) => l.locationId))
                  const derivedQty = qtyOf(line)
                  return (
                    <div key={line.key} className="grid grid-cols-[1fr_auto] gap-2 items-end border rounded-lg p-3">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-4 space-y-1">
                          <Label className="text-xs">Location</Label>
                          <Select value={line.locationId} onValueChange={(v) => setLine(line.key, { locationId: v })}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                            <SelectContent>
                              {locations.map((loc) => (
                                <SelectItem key={loc.id} value={loc.id} disabled={takenElsewhere.has(loc.id)}>
                                  {loc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {profile.trackGrade && (
                          <div className="md:col-span-4 space-y-1">
                            <Label className="text-xs">Grade</Label>
                            <GradeSelect
                              grades={grades}
                              value={line.gradeId}
                              onChange={(gradeId) => setLine(line.key, { gradeId })}
                              onGradeCreated={(g) => setGrades((prev) => [...prev, g])}
                            />
                          </div>
                        )}

                        {profile.trackLot && (
                          <div className="md:col-span-4 space-y-1">
                            <Label className="text-xs">Lot No.</Label>
                            <Input
                              value={line.lotNo}
                              placeholder="Auto if blank"
                              onChange={(e) => setLine(line.key, { lotNo: e.target.value })}
                            />
                          </div>
                        )}

                        {carton && (
                          <>
                            <div className="md:col-span-3 space-y-1">
                              <Label className="text-xs">Nos {profile.packUnit || 'Carton'}</Label>
                              <Input
                                type="number" min={0} step="0.0001" inputMode="decimal"
                                value={line.nosCarton}
                                onChange={(e) => setLine(line.key, { nosCarton: e.target.value })}
                                className="text-right"
                              />
                            </div>
                            <div className="md:col-span-3 space-y-1">
                              <Label className="text-xs">Weight / {profile.packUnit || 'Carton'} (kg){!needsWeight(profile.formula) && ' — optional'}</Label>
                              <Input
                                type="number" min={0} step="0.0001" inputMode="decimal"
                                value={line.weightPerCarton}
                                onChange={(e) => setLine(line.key, { weightPerCarton: e.target.value })}
                                className="text-right"
                              />
                            </div>
                          </>
                        )}

                        <div className="md:col-span-3 space-y-1">
                          <Label className="text-xs">Quantity ({unit}){carton && ' — auto'}</Label>
                          {carton ? (
                            <div className="flex h-9 items-center justify-end rounded-md border border-input bg-muted/40 px-3 text-sm tabular-nums text-muted-foreground">
                              {derivedQty > 0 ? derivedQty.toLocaleString('en-PK', { maximumFractionDigits: 4 }) : '—'}
                            </div>
                          ) : (
                            <Input
                              type="number" min={0} step="0.001" inputMode="decimal"
                              value={line.quantity}
                              onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                              className="text-right"
                            />
                          )}
                        </div>

                        <div className="md:col-span-3 space-y-1">
                          <Label className="text-xs">Cost per {unit} (PKR)</Label>
                          <Input
                            type="number" min={0} step="0.01" inputMode="decimal"
                            value={line.rate}
                            onChange={(e) => setLine(line.key, { rate: e.target.value })}
                            className="text-right"
                          />
                        </div>
                      </div>

                      <Button
                        type="button" size="sm" variant="ghost"
                        className="min-h-[44px] text-muted-foreground hover:text-destructive"
                        onClick={() => removeLine(line.key)}
                        disabled={lines.length === 1}
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>

              <Button type="button" variant="outline" size="sm" className="min-h-[44px]" onClick={addLine}>
                <Plus className="h-4 w-4 mr-2" /> {profile.trackGrade || profile.trackLot ? 'Add line' : 'Add location'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── SUMMARY (right on xl, sticky) ── */}
      <div className="xl:sticky xl:top-6">
        <Card>
          <CardContent className="px-5 pt-5 pb-5">
            <p className="font-extrabold text-[15px] tracking-tight mb-4">Opening Stock Summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Item</span>
                <span className="font-medium text-right truncate">{lot.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Locations</span>
                <span className="tabular-nums">{usedLocations}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Quantity</span>
                <span className="tabular-nums">{totalQty.toLocaleString('en-PK', { maximumFractionDigits: 4 })}{profile.stockUnit ? ` ${profile.stockUnit}` : ''}</span>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex justify-between items-center gap-2 mb-5">
              <span className="font-bold text-sm">Total Value</span>
              <span className="text-lg font-extrabold tabular-nums tracking-tight text-right">PKR {fmtPKR(totalValue)}</span>
            </div>

            <div className="space-y-2">
              {locations.length > 0 && (
                <Button className="w-full min-h-[44px]" onClick={save} disabled={isPending}>
                  {isPending ? 'Saving…' : 'Save opening stock'}
                </Button>
              )}
              <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.push(RETURN_PATH)} disabled={isPending}>
                Cancel
              </Button>
            </div>

            {error && <p className="text-sm text-destructive mt-3">{error}</p>}
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
