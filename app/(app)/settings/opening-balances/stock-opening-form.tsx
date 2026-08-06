'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { setStockOpeningBalances } from '@/app/actions/set-opening-balance'
import type { OpeningLot, LocationOption } from './stock-balance-table'

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
  trigger: ReactNode
  lot: OpeningLot
  locations: LocationOption[]
}

export function StockOpeningForm({ trigger, lot, locations }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<DraftLine[]>(() => toDraft(lot))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Re-seeding on open keeps the sheet in step with the row after a refresh,
  // and discards a half-finished edit that was cancelled.
  const onOpenChange = (next: boolean) => {
    if (next) {
      setLines(toDraft(lot))
      setError(null)
    }
    setOpen(next)
  }

  const num = (v: string) => parseFloat(v) || 0

  const setLine = (key: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const addLine = () =>
    setLines((prev) => [...prev, { key: Math.max(-1, ...prev.map((l) => l.key)) + 1, locationId: '', quantity: '', rate: '' }])

  const removeLine = (key: number) => setLines((prev) => prev.filter((l) => l.key !== key))

  const totalQty   = lines.reduce((s, l) => s + num(l.quantity), 0)
  const totalValue = lines.reduce((s, l) => s + num(l.quantity) * num(l.rate), 0)

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
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Opening stock — {lot.name}</SheetTitle>
          <SheetDescription>
            List every warehouse that held this item on day one. Add a line per location; the quantities are loaded at all of them together.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-4">
          {locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add a location under Inventory → Locations first.</p>
          ) : (
            <>
              <div className="space-y-3">
                {lines.map((line) => {
                  const takenElsewhere = new Set(lines.filter((l) => l.key !== line.key).map((l) => l.locationId))
                  return (
                    <div key={line.key} className="grid grid-cols-[1fr_auto] gap-2 items-end border rounded-lg p-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-3 sm:col-span-1 space-y-1">
                          <Label className="text-xs">Location</Label>
                          <Select value={line.locationId} onValueChange={(v) => setLine(line.key, { locationId: v })}>
                            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                            <SelectContent>
                              {locations.map((loc) => (
                                <SelectItem key={loc.id} value={loc.id} disabled={takenElsewhere.has(loc.id)}>
                                  {loc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Quantity</Label>
                          <Input
                            type="number" min={0} step="0.001" inputMode="decimal"
                            value={line.quantity}
                            onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                            className="text-right"
                          />
                        </div>

                        <div className="space-y-1">
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

              <div className="flex justify-between text-sm border-t pt-3">
                <span className="text-muted-foreground">Total</span>
                <span className="tabular-nums font-medium">
                  {totalQty.toLocaleString('en-PK', { maximumFractionDigits: 4 })} · PKR {fmtPKR(totalValue)}
                </span>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" className="min-h-[44px]" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
                <Button className="min-h-[44px]" onClick={save} disabled={isPending}>
                  {isPending ? 'Saving…' : 'Save opening stock'}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
