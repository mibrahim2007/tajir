// Cheque picker search check — run with `npm run check:cheque-search`.
//
// The picker hands on a physical cheque, so finding the wrong one is not a
// cosmetic bug — it endorses the wrong piece of paper to the wrong supplier.
// The rules pinned here are the ones that decide which cheque a typed query
// lands on, plus the one that keeps the field from blanking mid-search.
//
// No React and no network: the predicate is pure.

import { chequeMatches, filterCheques, type SearchableCheque } from '@/lib/pdc/search'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

const cheque = (over: Partial<SearchableCheque> = {}): SearchableCheque => ({
  chequeNumber: '0045123',
  partyName: 'Babar Textiles',
  docSerial: 'RV-0012',
  amount: 45000,
  dueDate: '2026-09-15',
  ...over,
})

console.log('\n— Finding a cheque by what is written on it —')
{
  const c = cheque()
  check('by full cheque number', chequeMatches(c, '0045123'))
  check('by the digits without leading zeros', chequeMatches(c, '45123'))
  check('by party name', chequeMatches(c, 'babar'))
  check('party match is case-insensitive', chequeMatches(c, 'BABAR'))
  check('by the voucher it arrived on', chequeMatches(c, 'rv-0012'))
  check('by due date', chequeMatches(c, '2026-09'))
  check('an empty query matches everything', chequeMatches(c, ''))
  check('whitespace only matches everything', chequeMatches(c, '   '))
}

console.log('\n— Amounts, typed either way —')
{
  const c = cheque({ amount: 45000 })
  check('bare digits', chequeMatches(c, '45000'))
  check('with thousands separators', chequeMatches(c, '45,000'))
  const big = cheque({ amount: 1250000 })
  check('a larger grouped amount', chequeMatches(big, '1,250,000'))
  check('and the same one bare', chequeMatches(big, '1250000'))
}

console.log('\n— Several words narrow, they do not widen —')
{
  const babar = cheque({ partyName: 'Babar Textiles', amount: 45000, chequeNumber: '0045123' })
  const other = cheque({ partyName: 'Makks International', amount: 45000, chequeNumber: '0099888' })

  check('both terms must match', chequeMatches(babar, 'babar 45000'))
  check('a cheque missing one term is excluded', !chequeMatches(other, 'babar 45000'))
  check('extra spaces are ignored', chequeMatches(babar, '  babar    45000  '))

  const results = filterCheques([babar, other], 'babar')
  check('filtering narrows the list', results.length === 1 && results[0].partyName === 'Babar Textiles',
    `${results.length} result(s)`)
}

console.log('\n— Nothing matches —')
{
  const list = [cheque(), cheque({ chequeNumber: '0099888', partyName: 'Makks' })]
  check('an unmatched query returns nothing', filterCheques(list, 'zzzzz').length === 0)
  check('an empty query returns everything', filterCheques(list, '').length === 2)
  check('a blank query returns everything', filterCheques(list, '   ').length === 2)
}

console.log('\n— Missing fields never throw —')
{
  const sparse: SearchableCheque = { chequeNumber: null, partyName: null, docSerial: null, amount: 0, dueDate: null }
  check('a cheque with no details is searchable', chequeMatches(sparse, '') === true)
  check('and simply does not match a term', !chequeMatches(sparse, 'babar'))
  check('a null-heavy list filters cleanly', filterCheques([sparse], 'x').length === 0)
}

console.log('\n— The selected cheque is never filtered away —')
{
  // The trigger renders its label from the selected option, so dropping that
  // option while the user types would blank the field they are looking at.
  const selected = cheque({ chequeNumber: '0045123', partyName: 'Babar Textiles' })
  const others = [cheque({ chequeNumber: '0099888', partyName: 'Makks' })]
  const list = [selected, ...others]

  const kept = filterCheques(list, 'makks', (c) => c.chequeNumber === '0045123')
  check('the selected one survives a non-matching query',
    kept.some((c) => c.chequeNumber === '0045123'), kept.map((c) => c.chequeNumber).join(', '))
  check('and the actual matches are still there',
    kept.some((c) => c.partyName === 'Makks'))

  const withoutGuard = filterCheques(list, 'makks')
  check('without the guard it would have been dropped',
    !withoutGuard.some((c) => c.chequeNumber === '0045123'))
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`)
process.exit(failures === 0 ? 0 : 1)
