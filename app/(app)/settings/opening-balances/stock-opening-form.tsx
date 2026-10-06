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
import { setStockOpeningBalances } from '@/app/actions/set-opening-balance'
import type { OpeningLot, LocationOption } from './stock-balance-table'

const RETURN_PATH = '/settings/opening-balances'

/** A line being edited. `key` only exists to keep React rows stable. */
type DraftLine = { key: number; locationId: string; quantity: string; rate: string }

function fmtPKR(n: number) {
  return n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function toDraft(lot: OpeningLot): DraftLine[] {
  if (lot.lines.length === 0) return [{ key: 0, locationId: '', quantity: '', rate: '' }]
  return lot.lines.map((l, i) => ({
    key: i,
    locationId: l.locationId,
    quantity: String(l.quantity),
    rate: String(l.rate),
  }))
}

type Props = {
  lot: OpeningLot
  locations: LocationOption[]
}

// Full-page form at /settings/opening-balances/stock/[id]/edit (was a drawer on
// Opening Balances).
export function StockOpeningForm({ lot, locations }: Props) {
  const router = useRouter()
  const [lines, setLines] = useState<DraftLine[]>(() => toDraft(lot))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const num = (v: string) => parseFloat(v) || 0

  const setLine = (key: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const addLine = () =>
    setLines((prev) => [...prev, { key: Math.max(-1, ...prev.map((l) => l.key)) + 1, locationId: '', quantity: '', rate: '' }])

  const removeLine = (key: number) => setLines((prev) => prev.filter((l) => l.key !== key))

  const totalQty   = lines.reduce((s, l) => s + num(l.quantity), 0)
  const totalValue = lines.reduce((s, l) => s + num(l.quantity) * num(l.rate), 0)
  const usedLocations = lines.filter((l) => l.locationId).length

  const save = () => {
    // Blank rows are how a user backs out of a location they added by mistake,
    // so drop them rather than making them fix it.
    const filled = lines.filter((l) => l.locationId || l.quantity || l.rate)

    if (filled.some((l) => !l.locationId)) { setError('Pick a location for every line'); return }

    const chosen = filled.map((l) => l.locationId)
    if (new Set(chosen).size !== chosen.length) { setError('Each location can only be listed once'); return }

    startTransition(async () => {
      setError(null)
      const result = await setStockOpeningBalances({
        lotId: lot.id,
        lines: filled.map((l) => ({ locationId: l.locationId, quantity: num(l.quantity), rate: num(l.rate) })),
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
                  const takenElsewhere = new Set(lines.filter((l) => l.key !== line.key).map((l) => l.locationId))
                  return (
                    <div key={line.key} className="grid grid-cols-[1fr_auto] gap-2 items-end border rounded-lg p-3">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-6 space-y-1">
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

                        <div className="md:col-span-3 space-y-1">
                          <Label className="text-xs">Quantity</Label>
                          <Input
                            type="number" min={0} step="0.001" inputMode="decimal"
                            value={line.quantity}
                            onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                            className="text-right"
                          />
                        </div>

                        <div className="md:col-span-3 space-y-1">
                          <Label className="text-xs">Rate (PKR)</Label>
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
                        aria-label="Remove location"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>

              <Button type="button" variant="outline" size="sm" className="min-h-[44px]" onClick={addLine}>
                <Plus className="h-4 w-4 mr-2" /> Add location
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
                <span className="tabular-nums">{totalQty.toLocaleString('en-PK', { maximumFractionDigits: 4 })}</span>
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
