// Purchase-return limit check — run with `npm run check:return-limit`.
//
// This guard decides whether a return is accepted, so getting it wrong either
// blocks legitimate returns or lets the books record more goods going back than
// ever arrived. The latter already happened: PO-2026-0016 carries 28,000
// returned against a 15,000 purchase, because the only check was whether enough
// stock existed to remove — a question about the ITEM, not about the ORDER.
//
// Pure arithmetic, no database.

import { checkReturnLimit } from '@/lib/purchases/return-limit'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

console.log('\n— Normal returns are allowed —')
{
  check('part of an untouched order',
    checkReturnLimit({ purchased: 100, alreadyReturned: 0, quantity: 10 }).ok)
  check('the whole of an untouched order',
    checkReturnLimit({ purchased: 100, alreadyReturned: 0, quantity: 100 }).ok)
  check('exactly what is left after a partial return',
    checkReturnLimit({ purchased: 100, alreadyReturned: 60, quantity: 40 }).ok)
  check('a second partial return within the remainder',
    checkReturnLimit({ purchased: 100, alreadyReturned: 60, quantity: 30 }).ok)
}

console.log('\n— Over-returning is refused —')
{
  const over = checkReturnLimit({ purchased: 100, alreadyReturned: 60, quantity: 41 })
  check('one unit past the remainder', !over.ok)
  check('and it says why', !over.ok && over.reason === 'exceeds_remaining', !over.ok ? over.reason : '')
  check('remaining is reported so the message can quote it', over.remaining === 40, String(over.remaining))

  const done = checkReturnLimit({ purchased: 100, alreadyReturned: 100, quantity: 1 })
  check('a fully returned order takes nothing more', !done.ok)
  check('and is reported as fully returned', !done.ok && done.reason === 'fully_returned', !done.ok ? done.reason : '')
}

console.log('\n— The exact case from production —')
{
  // PO-2026-0016: 15,000 bought, 15,000 returned, then 13,000 returned again.
  // Quantities stand in for value here; the guard works on quantity.
  const first = checkReturnLimit({ purchased: 15, alreadyReturned: 0, quantity: 15 })
  check('the first full return was legitimate', first.ok)

  const second = checkReturnLimit({ purchased: 15, alreadyReturned: 15, quantity: 13 })
  check('the second return is now refused', !second.ok, !second.ok ? second.reason : 'allowed')
  check('and reports nothing left', second.remaining === 0)
}

console.log('\n— Already-broken data does not break the guard —')
{
  // An order over-returned before the guard existed has negative headroom.
  const broken = checkReturnLimit({ purchased: 15, alreadyReturned: 28, quantity: 1 })
  check('further returns are refused', !broken.ok)
  check('remaining is floored at zero, never negative',
    broken.remaining === 0, String(broken.remaining))
}

console.log('\n— Odd inputs —')
{
  check('zero quantity is not blocked by this guard',
    checkReturnLimit({ purchased: 100, alreadyReturned: 0, quantity: 0 }).ok)
  check('a zero-quantity order has nothing to return',
    !checkReturnLimit({ purchased: 0, alreadyReturned: 0, quantity: 1 }).ok)
  check('fractional quantities work',
    checkReturnLimit({ purchased: 10.5, alreadyReturned: 10, quantity: 0.5 }).ok)
  check('and are refused when they overshoot',
    !checkReturnLimit({ purchased: 10.5, alreadyReturned: 10, quantity: 0.6 }).ok)
  check('NaN is treated as zero rather than throwing',
    !checkReturnLimit({ purchased: NaN, alreadyReturned: 0, quantity: 1 }).ok)
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`)
process.exit(failures === 0 ? 0 : 1)
