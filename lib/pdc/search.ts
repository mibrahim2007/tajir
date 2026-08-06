// Searching the cheques-in-hand picker.
//
// A tenant handing on a received cheque knows one of a few things about it —
// the number on the paper, who it came from, the voucher it arrived on, what it
// is worth, or when it matures. Any of those should find it, which is why the
// haystack is all of them joined rather than the cheque number alone.
//
// Kept free of React and server imports so the picker and the check script
// share one definition of what "matches" means.

export type SearchableCheque = {
  chequeNumber: string | null
  partyName: string | null
  docSerial: string | null
  amount: number
  dueDate: string | null
}

/**
 * Everything about a cheque that a person might type, lowercased.
 *
 * The amount appears twice — bare and grouped — so that both "45000" and
 * "45,000" find the same cheque. Someone reading a figure off a screen will
 * type the separators; someone reading it off a cheque will not.
 */
function haystack(c: SearchableCheque): string {
  const amount = Number(c.amount ?? 0)
  return [
    c.chequeNumber ?? '',
    c.partyName ?? '',
    c.docSerial ?? '',
    c.dueDate ?? '',
    String(amount),
    amount.toLocaleString('en-PK'),
  ]
    .join(' ')
    .toLowerCase()
}

/**
 * True when every word typed appears somewhere in the cheque.
 *
 * Terms are ANDed, so "babar 45000" narrows to that party's cheque for that
 * amount rather than returning everything belonging to either. Substring rather
 * than prefix matching means "45123" still finds cheque "0045123", which is how
 * the numbers are actually printed.
 */
export function chequeMatches(cheque: SearchableCheque, query: string): boolean {
  const terms = (query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const hay = haystack(cheque)
  return terms.every((t) => hay.includes(t))
}

/**
 * Filter a cheque list by a typed query.
 *
 * `alwaysInclude` exists for a specific bug: the picker's trigger renders its
 * label from the selected option, so filtering the selected cheque out of the
 * list blanks the field the user is looking at. The selected one is therefore
 * always kept, however the query reads.
 */
export function filterCheques<T extends SearchableCheque>(
  cheques: T[],
  query: string,
  alwaysInclude?: (cheque: T) => boolean,
): T[] {
  const q = (query ?? '').trim()
  if (!q) return cheques
  return cheques.filter((c) => chequeMatches(c, q) || (alwaysInclude?.(c) ?? false))
}
