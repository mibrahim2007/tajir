// Invoice-wise settlement for one party — shared by the customer side
// (lib/receivables/invoice-receivables.ts) and the supplier side
// (lib/payables/invoice-payables.ts).
//
// Settlement order:
//
//   1. Specific credits settle the invoice they name:
//        • a return or credit/debit note linked to one of the invoice's lines
//        • the part of a receipt/payment the user applied to that invoice
//      Anything beyond the invoice's amount spills into the pool.
//   2. The pool — every credit not tied to an invoice — settles what is left
//      oldest-first, the opening balance first of all. That is the FIFO
//      assumption Tajir has always made, applied only to the money the user
//      did not place.

/** Key used for the opening balance pseudo-document. */
export const OPENING_KEY = 'opening'

export type SettledDoc = {
  /** invoice_id ?? id of the line (see sale-detail), or OPENING_KEY. */
  key: string
  /** Set for real invoices; null for legacy single-line documents and the opening balance. */
  invoiceId: string | null
  isOpening: boolean
  date: string
  dueDate: string | null
  serial: string | null
  /** The party's reference: PO no. on a sale, the supplier's bill no. on a purchase. */
  ref: string | null
  amount: number
  /** Linked returns and credit / debit notes. */
  returned: number
  /** Receipt / payment money the user applied to this invoice. */
  applied: number
  /** Share of the unallocated pool that settled it, oldest-first. */
  fifo: number
  balance: number
}

export type DocInput = Omit<SettledDoc, 'returned' | 'applied' | 'fifo' | 'balance'>
export type SpecificCredit = { key: string; amount: number; kind: 'returned' | 'applied' }

export type SettledParty = {
  partyId: string
  partyName: string
  docs: SettledDoc[]
  /** Pool left over after every document was settled — an advance / credit balance. */
  unappliedCredit: number
}

const EPS = 0.005

/** Pure settlement for one party. */
export function settleParty(docs: DocInput[], specific: SpecificCredit[], pool: number): { docs: SettledDoc[]; unappliedCredit: number } {
  const out: SettledDoc[] = docs
    .map((d) => ({ ...d, returned: 0, applied: 0, fifo: 0, balance: d.amount }))
    .sort((a, b) => (a.isOpening === b.isOpening ? 0 : a.isOpening ? -1 : 1) || a.date.localeCompare(b.date) || (a.serial ?? '').localeCompare(b.serial ?? ''))
  const byKey = new Map(out.map((d) => [d.key, d]))

  let remainingPool = pool
  for (const c of specific) {
    const doc = byKey.get(c.key)
    // Opening balance has no invoice to name; an unknown key means the invoice
    // was deleted or now belongs to someone else. Either way: unallocated.
    if (!doc || doc.isOpening) { remainingPool += c.amount; continue }
    const applied = Math.min(c.amount, Math.max(doc.balance, 0))
    doc[c.kind] += applied
    doc.balance -= applied
    remainingPool += c.amount - applied
  }

  for (const doc of out) {
    if (remainingPool <= EPS) break
    if (doc.balance <= EPS) continue
    const applied = Math.min(remainingPool, doc.balance)
    doc.fifo += applied
    doc.balance -= applied
    remainingPool -= applied
  }

  return { docs: out, unappliedCredit: Math.max(remainingPool, 0) }
}

/** Only the documents still owed on. */
export function openDocs(p: { docs: SettledDoc[] }): SettledDoc[] {
  return p.docs.filter((d) => d.balance > EPS)
}

/**
 * Collects credits per party while a loader walks its documents: specific
 * credits by invoice key, the rest into the FIFO pool.
 */
export function creditBook() {
  const specific = new Map<string, SpecificCredit[]>()
  const pool = new Map<string, number>()
  return {
    addPool: (partyId: string, n: number) => pool.set(partyId, (pool.get(partyId) ?? 0) + n),
    addSpecific: (partyId: string, c: SpecificCredit) => {
      const list = specific.get(partyId) ?? []
      list.push(c)
      specific.set(partyId, list)
    },
    specificFor: (partyId: string) => specific.get(partyId) ?? [],
    poolFor: (partyId: string) => pool.get(partyId) ?? 0,
  }
}
