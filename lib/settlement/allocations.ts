import { z } from 'zod'
import type { SettledParty } from '@/lib/settlement/invoice-settlement'

// Validation for "receipt / payment against invoice" allocations, shared by
// lib/receivables/receipt-allocations.ts and lib/payables/payment-allocations.ts.

export const allocationSchema = z.object({
  invoiceKey: z.string().uuid('Invalid invoice'),
  amount:     z.coerce.number().positive('Applied amount must be positive'),
})

export type Allocation = z.infer<typeof allocationSchema>

export const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Returns an error or null. `party` must be settled WITHOUT the document being
 * saved (see the loaders' exclude option).
 *
 * Each invoice must belong to the party, the total cannot exceed the
 * document, and no invoice can take more than is still open on it once
 * returns, notes and other documents' allocations are taken off. Money that
 * FIFO had parked on an invoice does not count against it — placing this
 * document there simply moves that unallocated money to the next invoice.
 */
export function validateAllocations(
  party: SettledParty | undefined,
  allocations: Allocation[],
  documentPkr: number,
  noun: 'receipt' | 'payment',
  partyNoun: 'customer' | 'supplier',
): string | null {
  if (allocations.length === 0) return null

  const keys = allocations.map((a) => a.invoiceKey)
  if (new Set(keys).size !== keys.length) return 'The same invoice is listed twice'

  const total = allocations.reduce((s, a) => s + a.amount, 0)
  if (r2(total) > r2(documentPkr) + 0.01) return `Applied to invoices is more than the ${noun} amount`

  const docs = new Map((party?.docs ?? []).filter((d) => !d.isOpening).map((d) => [d.key, d]))
  for (const a of allocations) {
    const doc = docs.get(a.invoiceKey)
    if (!doc) return `An invoice applied to does not belong to this ${partyNoun}`
    const open = doc.balance + doc.fifo
    if (r2(a.amount) > r2(open) + 0.01) {
      return `Invoice ${doc.serial ?? ''} has only ${r2(open).toLocaleString('en-PK')} open`.replace('  ', ' ')
    }
  }
  return null
}
