// Item-type formula check — run with `npm run check:item-formula`.
//
// Every stock item has an Item Type, and the type's formula decides how a
// trading line is measured and billed (lib/item-formula.ts, migration 0071).
// The trading forms and the server actions both go through these helpers, so
// a slip here mis-bills every invoice of that type. The cases follow the yarn
// receipt sheet: polyester cartons priced per lb, a total-weight carton
// receipt, cotton bags priced per bag, plus plain count items and yarn.
//
// No database and no credentials: the helpers are pure.

import {
  billingQty, cartonStockQty, lineGrossAmount, lineQtyLbs, normalizeFormula,
  suggestFormula, usesCartons, needsWeight, tracksGradeLot,
} from '@/lib/item-formula'
import { LBS_PER_KG } from '@/lib/polyester'
import { resolveLineTracking, findPositionShortfalls } from '@/lib/inventory/line-tracking'
import { availableAt, type StockPosition } from '@/lib/inventory/stock-position'
import { unitCostFor, costLines, type CostReceipt } from '@/lib/inventory/costing'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}
const near = (a: number, b: number, eps = 0.01) => Math.abs(a - b) < eps

// ── standard: Qty × Rate, cartons ignored ──────────────────────────────────
{
  const l = { quantity: 12, nosCarton: 5, weightPerCarton: 30 }
  check('standard: billed on quantity', billingQty('standard', l) === 12)
  check('standard: amount = qty × rate × fx', lineGrossAmount('standard', l, 100, 2) === 2400)
  check('standard: no derived stock qty', cartonStockQty('standard', l) === null)
  check('standard: no QTY LBS', lineQtyLbs('standard', l) === null)
}

// ── yarn: Multiply By scales the amount only ───────────────────────────────
{
  const l = { quantity: 10, multiplyBy: 1.5 }
  check('yarn: amount = qty × rate × multiply_by', lineGrossAmount('yarn', l, 200) === 3000)
  check('yarn: blank multiplier counts as 1', lineGrossAmount('yarn', { quantity: 10 }, 200) === 2000)
  check('standard ignores a stray multiplier', lineGrossAmount('standard', l, 200) === 2000)
}

// ── per_lb: 100 cartons × 33 kg (sheet row ABC) ────────────────────────────
{
  const l = { nosCarton: 100, weightPerCarton: 33, quantity: 999 }
  check('per_lb: stock = cartons × kg', cartonStockQty('per_lb', l) === 3300)
  // Uses the app's current QTY LBS rule (kg / LBS_PER_KG), unchanged here.
  const lbs = 3300 / LBS_PER_KG
  check('per_lb: billed on QTY LBS', near(billingQty('per_lb', l), lbs))
  check('per_lb: QTY LBS stored', near(lineQtyLbs('per_lb', l) ?? 0, lbs))
  check('per_lb: amount = lbs × rate', near(lineGrossAmount('per_lb', l, 295), lbs * 295))
  check('per_lb: typed quantity is ignored', near(lineGrossAmount('per_lb', l, 1), lbs))
}

// ── per_kg: total weight 2950 kg over 100 cartons (sheet row DEF) ───────────
{
  const l = { nosCarton: 100, weightPerCarton: 29.5 }
  check('per_kg: stock = cartons × kg', near(cartonStockQty('per_kg', l) ?? 0, 2950))
  check('per_kg: amount = kg × rate', near(lineGrossAmount('per_kg', l, 650), 2950 * 650))
  check('per_kg: no QTY LBS', lineQtyLbs('per_kg', l) === null)
}

// ── per_pack: 100 bags × Rs 36,000 (sheet row XYZ) ─────────────────────────
{
  const l = { nosCarton: 100, weightPerCarton: 45.36 }
  check('per_pack: stock = packs', cartonStockQty('per_pack', l) === 100)
  check('per_pack: amount = packs × rate', lineGrossAmount('per_pack', l, 36000) === 3_600_000)
  check('per_pack: weight is optional', lineGrossAmount('per_pack', { nosCarton: 100 }, 36000) === 3_600_000)
  check('per_pack: weight not required', !needsWeight('per_pack'))
}

// ── blanks never produce NaN ───────────────────────────────────────────────
for (const f of ['standard', 'yarn', 'per_lb', 'per_kg', 'per_pack'] as const) {
  const amt = lineGrossAmount(f, { quantity: undefined, nosCarton: NaN, weightPerCarton: null }, 100)
  check(`${f}: blank line amounts to 0`, amt === 0, `got ${amt}`)
}

// ── classification ─────────────────────────────────────────────────────────
check('carton formulas', usesCartons('per_lb') && usesCartons('per_kg') && usesCartons('per_pack'))
check('non-carton formulas', !usesCartons('standard') && !usesCartons('yarn'))
check('unknown formula falls back to standard', normalizeFormula('per_ton') === 'standard')
check('suggest: polyester → per_lb', suggestFormula('Polyester 150/144') === 'per_lb')
check('suggest: misspelt ployester → per_lb', suggestFormula('150D Ployester') === 'per_lb')
check('suggest: Yarn → yarn', suggestFormula(' yarn ') === 'yarn')
check('suggest: anything else → standard', suggestFormula('Electric') === 'standard')

// ── rate basis → grade / lot (0074) ─────────────────────────────────────────
check('Qty × Rate lines skip grade / lot', !tracksGradeLot('standard'))
check('weighed / packed / yarn lines need grade / lot', tracksGradeLot('per_lb') && tracksGradeLot('per_kg') && tracksGradeLot('per_pack') && tracksGradeLot('yarn'))

// ── grade / lot rules (0072) ───────────────────────────────────────────────
{
  const both = { trackGrade: true, trackLot: true }
  const none = { trackGrade: false, trackLot: false }
  const r1 = resolveLineTracking(both, { gradeId: null, lotNo: 'L1' }, { lineLabel: 'Line 1' })
  check('tracked grade is required', !r1.ok)
  const r2 = resolveLineTracking(both, { gradeId: 'g1', lotNo: '  ' }, { lineLabel: 'Line 2' })
  check('tracked lot is required when nothing generates it', !r2.ok)
  const r3 = resolveLineTracking(both, { gradeId: 'g1', lotNo: '' }, { lineLabel: 'Line 3', generateLot: { serialNumber: 'PI-0012', lineIndex: 2 } })
  check('purchase generates a blank lot from the serial', r3.ok && r3.lotNo === 'PI-0012/3')
  const r4 = resolveLineTracking(both, { gradeId: 'g1', lotNo: ' L7 ' }, { lineLabel: 'Line 4', generateLot: { serialNumber: 'PI-0012', lineIndex: 0 } })
  check('a typed lot is kept (trimmed)', r4.ok && r4.lotNo === 'L7')
  const r5 = resolveLineTracking(none, { gradeId: 'g1', lotNo: 'L1' }, { lineLabel: 'Line 5' })
  check('untracked items store no grade / lot', r5.ok && r5.gradeId === null && r5.lotNo === null)
}

// ── stock per grade / lot position ─────────────────────────────────────────
{
  const pos: StockPosition[] = [
    { stockItemId: 'i1', locationId: 'gd1', gradeId: 'AA', lotNo: 'L1', quantity: 3300, packs: 100 },
    { stockItemId: 'i1', locationId: 'gd1', gradeId: 'A',  lotNo: 'L2', quantity: 2950, packs: 100 },
    { stockItemId: 'i1', locationId: 'gd2', gradeId: 'AA', lotNo: 'L3', quantity: 500,  packs: 15 },
  ]
  check('available: one grade at one godown', availableAt(pos, { stockItemId: 'i1', locationId: 'gd1', gradeId: 'AA' }).quantity === 3300)
  check('available: any grade at one godown', availableAt(pos, { stockItemId: 'i1', locationId: 'gd1' }).packs === 200)
  const line = { stockItemId: 'i1', locationId: 'gd1', gradeId: 'AA', lotNo: 'L1', trackGrade: true, trackLot: true }
  check('selling within a lot is fine', findPositionShortfalls(pos, [{ ...line, quantity: 3300 }]).length === 0)
  const short = findPositionShortfalls(pos, [{ ...line, quantity: 2000 }, { ...line, quantity: 2000 }])
  check('two lines from one lot are totalled', short.length === 1 && short[0].requested === 4000 && short[0].available === 3300)
  check('an edit gets its own old lines back', findPositionShortfalls(pos, [{ ...line, quantity: 4000 }], [{ ...line, quantity: 1000 }]).length === 0)
  check('untracked items are not checked here', findPositionShortfalls(pos, [{ ...line, trackGrade: false, trackLot: false, quantity: 99999 }]).length === 0)
}

// ── cost per stock unit (0073) ──────────────────────────────────────────────
{
  // Sheet rows ABC and DEF as two lots of the same item, plus an opening lot.
  const receipts: CostReceipt[] = [
    { stockItemId: 'i1', gradeId: 'AA', lotNo: 'L1', quantity: 3300, value: 2_146_178 },
    { stockItemId: 'i1', gradeId: 'A',  lotNo: 'L2', quantity: 2950, value: 1_918_553 },
    { stockItemId: 'i1', gradeId: 'AA', lotNo: 'OB/1', quantity: 1000, value: 600_000 },
    // purchase return of 300 kg from L1 at its purchase value
    { stockItemId: 'i1', gradeId: 'AA', lotNo: 'L1', quantity: -300, value: -195_107.09 },
  ]
  const lot1 = unitCostFor(receipts, { stockItemId: 'i1', gradeId: 'AA', lotNo: 'L1', trackGrade: true, trackLot: true })
  check('lot cost = lot value / lot qty (net of returns)', near(lot1 ?? 0, (2_146_178 - 195_107.09) / 3000))
  const gradeOnly = unitCostFor(receipts, { stockItemId: 'i1', gradeId: 'AA', trackGrade: true })
  check('grade-only cost spans all lots of that grade', near(gradeOnly ?? 0, (2_146_178 - 195_107.09 + 600_000) / 4000))
  const avg = unitCostFor(receipts, { stockItemId: 'i1' })
  check('untracked: item average', near(avg ?? 0, (2_146_178 + 1_918_553 + 600_000 - 195_107.09) / 6950))
  const unknownLot = unitCostFor(receipts, { stockItemId: 'i1', gradeId: 'AA', lotNo: 'nope', trackGrade: true, trackLot: true })
  check('a lot with no receipts falls back to the item average', near(unknownLot ?? 0, avg ?? 0))
  check('no receipts: opening rate fallback', unitCostFor([], { stockItemId: 'x' }, 250) === 250)
  check('no receipts, no rate: no cost', unitCostFor([], { stockItemId: 'x' }) === null)
  const [c] = costLines({ receipts, openingRates: new Map() }, [{ stockItemId: 'i1', gradeId: 'A', lotNo: 'L2', trackGrade: true, trackLot: true, quantity: 100 }])
  check('line cost = rate × qty, rounded to paisa', near(c.costAmount, Math.round(1_918_553 / 2950 * 100 * 100) / 100))
}

console.log(failures === 0 ? '\nAll item formula checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
