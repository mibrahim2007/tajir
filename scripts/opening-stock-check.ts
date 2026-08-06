// Opening stock maths check — run with `npm run check:opening-stock`.
//
// An item's opening quantity is now split across the warehouses that held it,
// which means two figures have to stay in step with each other:
//
//   • stock_opening_balances — the per-location baseline the
//     location_stock_summary view attributes to each warehouse
//   • inventory_lots.current_quantity — the item's RUNNING total, which is
//     that baseline plus every movement since
//
// The failure mode is quiet. If saving an opening balance overwrites the
// running total instead of shifting it, the purchases and sales posted after
// setup are erased from the item's on-hand figure and nothing looks broken —
// the number is simply wrong. So the invariant asserted throughout is:
//
//     current_quantity - opening_total  ==  net movement  (unchanged by a save)
//
// No database and no credentials: planOpeningStock is pure.

import { planOpeningStock, type OpeningStockLine } from '@/lib/inventory/opening-stock'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const C = '33333333-3333-3333-3333-333333333333'

const line = (locationId: string, quantity: number, rate = 0): OpeningStockLine => ({ locationId, quantity, rate })

/** Unwraps a plan that is expected to succeed. */
function plan(args: Parameters<typeof planOpeningStock>[0]) {
  const result = planOpeningStock(args)
  if (!result.ok) throw new Error(`expected a plan, got: ${result.error}`)
  return result.plan
}

console.log('\n— First entry, one location —')
{
  const p = plan({ currentQuantity: 0, existing: [], lines: [line(A, 100, 250)] })
  check('opening total is the line', p.openingTotal === 100, `${p.openingTotal}`)
  check('current_quantity picks it up', p.currentQuantity === 100, `${p.currentQuantity}`)
  check('rate carries through', p.openingRate === 250, `${p.openingRate}`)
  check('primary location set', p.primaryLocationId === A)
  check('nothing removed', p.removedLocationIds.length === 0)
}

console.log('\n— The feature: one item at three locations at once —')
{
  const p = plan({
    currentQuantity: 0,
    existing: [],
    lines: [line(A, 60, 200), line(B, 40, 300), line(C, 100, 250)],
  })
  check('all three stored', p.lines.length === 3)
  check('total is the sum', p.openingTotal === 200, `${p.openingTotal}`)
  check('current_quantity is the sum', p.currentQuantity === 200, `${p.currentQuantity}`)
  // (60×200 + 40×300 + 100×250) / 200 = 245
  check('rate is quantity-weighted', p.openingRate === 245, `${p.openingRate}`)
  check('primary is the largest line', p.primaryLocationId === C)
}

console.log('\n— Splitting an existing single-location opening —')
{
  // 100 loaded at A, then 30 sold: running total 70, baseline still 100.
  const p = plan({
    currentQuantity: 70,
    existing: [{ locationId: A, quantity: 100 }],
    lines: [line(A, 60, 250), line(B, 40, 250)],
  })
  check('opening still totals 100', p.openingTotal === 100, `${p.openingTotal}`)
  check('the sale is NOT erased', p.currentQuantity === 70, `${p.currentQuantity}`)
  check('net movement preserved', p.currentQuantity - p.openingTotal === -30)
  check('A is not dropped', p.removedLocationIds.length === 0)
}

console.log('\n— Raising and lowering an opening moves the running total by the difference —')
{
  const raised = plan({
    currentQuantity: 70,
    existing: [{ locationId: A, quantity: 100 }],
    lines: [line(A, 100, 250), line(B, 25, 250)],
  })
  check('raise: +25 on the running total', raised.currentQuantity === 95, `${raised.currentQuantity}`)
  check('raise: movement still -30', raised.currentQuantity - raised.openingTotal === -30)

  const lowered = plan({
    currentQuantity: 70,
    existing: [{ locationId: A, quantity: 100 }],
    lines: [line(A, 80, 250)],
  })
  check('lower: -20 on the running total', lowered.currentQuantity === 50, `${lowered.currentQuantity}`)
  check('lower: movement still -30', lowered.currentQuantity - lowered.openingTotal === -30)
}

console.log('\n— Dropping a location —')
{
  const p = plan({
    currentQuantity: 100,
    existing: [{ locationId: A, quantity: 60 }, { locationId: B, quantity: 40 }],
    lines: [line(A, 60, 250), line(B, 0, 0)],
  })
  check('zeroed line is not stored', p.lines.length === 1 && p.lines[0].locationId === A)
  check('B queued for deletion', p.removedLocationIds.length === 1 && p.removedLocationIds[0] === B)
  check('running total drops by 40', p.currentQuantity === 60, `${p.currentQuantity}`)
}

console.log('\n— Clearing an opening entirely —')
{
  const p = plan({
    currentQuantity: 100,
    existing: [{ locationId: A, quantity: 60 }, { locationId: B, quantity: 40 }],
    lines: [],
  })
  check('no lines left', p.lines.length === 0)
  check('both queued for deletion', p.removedLocationIds.length === 2)
  check('running total back to movement only', p.currentQuantity === 0, `${p.currentQuantity}`)
  check('rate cleared', p.openingRate === 0)
  check('primary location cleared', p.primaryLocationId === null)
}

console.log('\n— Refusals —')
{
  const dupe = planOpeningStock({ currentQuantity: 0, existing: [], lines: [line(A, 10, 1), line(A, 5, 1)] })
  check('same location twice is refused', !dupe.ok && dupe.error.includes('only be listed once'))

  // 100 loaded, 90 sold; an opening of 5 would imply -5 on hand.
  const short = planOpeningStock({
    currentQuantity: 10,
    existing: [{ locationId: A, quantity: 100 }],
    lines: [line(A, 5, 250)],
  })
  check('opening below what was sold is refused', !short.ok && short.error.includes('already been sold'))

  // The same reduction is fine once it no longer drives the total negative.
  const ok = planOpeningStock({
    currentQuantity: 10,
    existing: [{ locationId: A, quantity: 100 }],
    lines: [line(A, 90, 250)],
  })
  check('the boundary case still saves', ok.ok && ok.plan.currentQuantity === 0)
}

console.log('\n— Decimals stay inside the column scale —')
{
  const p = plan({
    currentQuantity: 0,
    existing: [],
    lines: [line(A, 0.1, 3.3333), line(B, 0.2, 6.6667)],
  })
  check('quantity to 3 dp', p.openingTotal === 0.3, `${p.openingTotal}`)
  check('current_quantity to 3 dp', p.currentQuantity === 0.3, `${p.currentQuantity}`)
  check('rate to 4 dp', String(p.openingRate).replace(/^\d+\./, '').length <= 4, `${p.openingRate}`)
  check('weighted rate is right', p.openingRate === 5.5556, `${p.openingRate}`)
}

console.log('\n— Rate with no quantity —')
{
  // A cost recorded before the count is known: keep the rate, store no stock.
  const p = plan({ currentQuantity: 0, existing: [], lines: [line(A, 0, 250)] })
  check('line kept for its rate', p.lines.length === 1)
  check('no quantity added', p.currentQuantity === 0)
  check('rate retained', p.openingRate === 250, `${p.openingRate}`)
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`)
process.exit(failures === 0 ? 0 : 1)
