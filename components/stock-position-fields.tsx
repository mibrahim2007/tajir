'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { GradeOption } from '@/app/actions/grades'
import type { StockPosition } from '@/lib/inventory/stock-position'

const ANY = '__any__'
const fmtQty = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 3 })

// Grade and lot pickers for a line that takes stock OUT (sale, purchase return,
// transfer): the choices are the grade / lot positions the item actually holds
// at the chosen location, each labelled with what is on hand. Only the pickers
// the item type tracks are shown.
export function StockPositionFields({
  positions,
  stockItemId,
  locationId,
  grades,
  trackGrade,
  trackLot,
  gradeId,
  lotNo,
  onChange,
  stockUnit,
  packUnit,
  className = 'h-9 w-full',
  invalid = false,
}: {
  positions: StockPosition[]
  stockItemId: string | undefined
  locationId: string | null | undefined
  grades: GradeOption[]
  trackGrade: boolean
  trackLot: boolean
  gradeId: string | null | undefined
  lotNo: string | null | undefined
  onChange: (next: { gradeId: string | null; lotNo: string | null }) => void
  stockUnit?: string | null
  packUnit?: string | null
  className?: string
  invalid?: boolean
}) {
  if (!trackGrade && !trackLot) return null

  const here = positions.filter((p) => p.stockItemId === stockItemId && (!locationId || p.locationId === locationId) && p.quantity > 0)
  const gradeName = (id: string | null) => (id ? grades.find((g) => g.id === id)?.name ?? 'Unknown grade' : 'No grade')
  const label = (qty: number, packs: number) =>
    `${fmtQty(qty)}${stockUnit ? ` ${stockUnit}` : ''}${packs ? ` · ${fmtQty(packs)} ${packUnit || 'ctn'}` : ''}`

  // Grade choices: totals per grade at this location.
  const byGrade = new Map<string, { gradeId: string | null; qty: number; packs: number }>()
  for (const p of here) {
    const k = p.gradeId ?? ''
    const cur = byGrade.get(k) ?? { gradeId: p.gradeId, qty: 0, packs: 0 }
    cur.qty += p.quantity; cur.packs += p.packs
    byGrade.set(k, cur)
  }
  // Lot choices: within the chosen grade when grade is tracked.
  const lots = here.filter((p) => !trackGrade || (p.gradeId ?? null) === (gradeId ?? null))
  const byLot = new Map<string, { lotNo: string | null; gradeId: string | null; qty: number; packs: number }>()
  for (const p of lots) {
    const k = p.lotNo ?? ''
    const cur = byLot.get(k) ?? { lotNo: p.lotNo, gradeId: p.gradeId, qty: 0, packs: 0 }
    cur.qty += p.quantity; cur.packs += p.packs
    byLot.set(k, cur)
  }

  const noStock = !stockItemId ? 'Pick an item first' : !locationId ? 'Pick a location first' : 'No stock here'

  return (
    <div className="flex flex-wrap gap-2">
      {trackGrade && (
        <div className="min-w-[10rem] flex-1">
          <Select
            value={gradeId ?? ''}
            onValueChange={(v) => onChange({ gradeId: v || null, lotNo: trackLot ? null : (lotNo ?? null) })}
          >
            <SelectTrigger className={className} aria-invalid={invalid && !gradeId ? true : undefined}>
              <SelectValue placeholder={byGrade.size ? 'Grade…' : noStock} />
            </SelectTrigger>
            <SelectContent>
              {[...byGrade.values()].filter((g) => g.gradeId).map((g) => (
                <SelectItem key={g.gradeId!} value={g.gradeId!}>
                  {gradeName(g.gradeId)} <span className="text-muted-foreground">({label(g.qty, g.packs)})</span>
                </SelectItem>
              ))}
              {/* Keep a saved grade selectable even if its stock is gone (editing). */}
              {gradeId && !byGrade.has(gradeId) && <SelectItem value={gradeId}>{gradeName(gradeId)}</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      )}
      {trackLot && (
        <div className="min-w-[10rem] flex-1">
          <Select
            value={lotNo ?? ''}
            onValueChange={(v) => {
              const hit = byLot.get(v === ANY ? '' : v)
              onChange({ gradeId: trackGrade ? (gradeId ?? hit?.gradeId ?? null) : null, lotNo: v === ANY ? null : v })
            }}
          >
            <SelectTrigger className={className} aria-invalid={invalid && !lotNo ? true : undefined}>
              <SelectValue placeholder={byLot.size ? 'Lot…' : (trackGrade && !gradeId ? 'Pick a grade first' : noStock)} />
            </SelectTrigger>
            <SelectContent>
              {[...byLot.values()].filter((l) => l.lotNo).map((l) => (
                <SelectItem key={l.lotNo!} value={l.lotNo!}>
                  {l.lotNo} <span className="text-muted-foreground">({label(l.qty, l.packs)})</span>
                </SelectItem>
              ))}
              {lotNo && !byLot.has(lotNo) && <SelectItem value={lotNo}>{lotNo}</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
