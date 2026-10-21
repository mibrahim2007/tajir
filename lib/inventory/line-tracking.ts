// Grade / lot rules for a stock line, shared by every document that moves
// stock (purchase, sale, both returns, transfers, opening stock). Pure, so it
// is checked by `npm run check:item-formula`.
//
//   item type tracks grade → the line must name a grade
//   item type tracks lot   → the line must carry a lot number; documents that
//                            bring stock IN (purchase, opening) generate one
//                            when it is left blank
//   neither                → grade and lot are stored empty, as before

import type { ItemProfile } from './item-profiles'
import { autoLotNo, availableAt, normalizeLotNo, positionKey, type StockPosition } from './stock-position'

export type LineTrackingInput = { gradeId?: string | null; lotNo?: string | null }

export type LineTrackingResult =
  | { ok: true; gradeId: string | null; lotNo: string | null }
  | { ok: false; error: string }

export function resolveLineTracking(
  profile: Pick<ItemProfile, 'trackGrade' | 'trackLot'>,
  line: LineTrackingInput,
  opts: { lineLabel: string; generateLot?: { serialNumber: string | null; lineIndex: number } },
): LineTrackingResult {
  const gradeId = profile.trackGrade ? (line.gradeId || null) : null
  if (profile.trackGrade && !gradeId) return { ok: false, error: `${opts.lineLabel}: select a grade` }

  let lotNo = profile.trackLot ? normalizeLotNo(line.lotNo) : null
  if (profile.trackLot && !lotNo) {
    if (!opts.generateLot) return { ok: false, error: `${opts.lineLabel}: select a lot number` }
    lotNo = autoLotNo(opts.generateLot.serialNumber, opts.generateLot.lineIndex)
  }
  return { ok: true, gradeId, lotNo }
}

export type OutgoingLine = {
  stockItemId: string
  locationId:  string | null
  gradeId:     string | null
  lotNo:       string | null
  quantity:    number
  /** Only check grade / lot when the item tracks them. */
  trackGrade:  boolean
  trackLot:    boolean
}

export type PositionShortfall = {
  stockItemId: string
  locationId:  string
  gradeId:     string | null
  lotNo:       string | null
  available:   number
  requested:   number
}

// Lines taking stock OUT of a tracked grade / lot, totalled per position and
// compared with what that position holds. `credit` adds back stock the same
// document already took (an edit re-saving its own lines). Untracked items and
// lines without a location are not checked here; the item-level check covers them.
export function findPositionShortfalls(
  positions: StockPosition[],
  lines: OutgoingLine[],
  credit: OutgoingLine[] = [],
): PositionShortfall[] {
  const want = new Map<string, OutgoingLine & { locationId: string }>()
  const requested = new Map<string, number>()
  for (const l of lines) {
    if (!l.locationId || (!l.trackGrade && !l.trackLot)) continue
    const k = positionKey({ ...l, locationId: l.locationId, gradeId: l.trackGrade ? l.gradeId : undefined, lotNo: l.trackLot ? l.lotNo : undefined })
    want.set(k, { ...l, locationId: l.locationId })
    requested.set(k, (requested.get(k) ?? 0) + l.quantity)
  }
  const back = new Map<string, number>()
  for (const l of credit) {
    if (!l.locationId) continue
    const k = positionKey({ ...l, locationId: l.locationId, gradeId: l.trackGrade ? l.gradeId : undefined, lotNo: l.trackLot ? l.lotNo : undefined })
    back.set(k, (back.get(k) ?? 0) + l.quantity)
  }
  const out: PositionShortfall[] = []
  for (const [k, l] of want) {
    const available = availableAt(positions, {
      stockItemId: l.stockItemId,
      locationId:  l.locationId,
      gradeId:     l.trackGrade ? l.gradeId : undefined,
      lotNo:       l.trackLot ? l.lotNo : undefined,
    }).quantity + (back.get(k) ?? 0)
    const req = requested.get(k) ?? 0
    if (req > available + 1e-9) {
      out.push({ stockItemId: l.stockItemId, locationId: l.locationId, gradeId: l.gradeId, lotNo: l.lotNo, available, requested: req })
    }
  }
  return out
}
