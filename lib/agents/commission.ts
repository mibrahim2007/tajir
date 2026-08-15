import { z } from 'zod'

// Pure commission arithmetic — no I/O, so both the server actions and the live
// preview on the invoice forms compute from exactly the same code.

export const COMMISSION_TYPES = [
  { value: 'percentage', label: '% of invoice value', unit: '%' },
  { value: 'per_unit',   label: 'Per unit',           unit: 'PKR/unit' },
  { value: 'flat',       label: 'Flat per invoice',   unit: 'PKR' },
  { value: 'none',       label: 'No commission',      unit: '' },
] as const

export type CommissionType = (typeof COMMISSION_TYPES)[number]['value']

/** Types that actually accrue — `none` is excluded, and never reaches the GL. */
export type AccruingCommissionType = Exclude<CommissionType, 'none'>

export const COMMISSION_TYPE_VALUES = COMMISSION_TYPES.map((t) => t.value) as unknown as [CommissionType, ...CommissionType[]]

export const commissionTypeSchema = z.enum(COMMISSION_TYPE_VALUES)

export const COMMISSION_TYPE_LABEL: Record<CommissionType, string> =
  Object.fromEntries(COMMISSION_TYPES.map((t) => [t.value, t.label])) as Record<CommissionType, string>

/** Which side of the book the commission is earned on. */
export type CommissionSide = 'sale' | 'purchase'

export type CommissionBasis = {
  type: CommissionType
  /** Percent for 'percentage', PKR per unit for 'per_unit', PKR for 'flat'. */
  rate: number
  /** Invoice value in PKR — the base for 'percentage'. */
  baseAmount: number
  /** Total invoice quantity — the base for 'per_unit'. */
  baseQuantity: number
}

/** Money is stored to 2 decimals; round once, here, so the GL legs always tie. */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Commission earned on one document, in PKR.
 *
 * Returns 0 for 'none', a non-positive rate, or a base that produces nothing —
 * callers treat 0 as "no accrual" and skip both the row and the GL legs, so a
 * zero-value journal entry never reaches the ledger.
 */
export function computeCommission(basis: CommissionBasis): number {
  const { type, rate, baseAmount, baseQuantity } = basis
  if (type === 'none' || !Number.isFinite(rate) || rate <= 0) return 0

  switch (type) {
    case 'percentage':
      return roundMoney((baseAmount * rate) / 100)
    case 'per_unit':
      return roundMoney(baseQuantity * rate)
    case 'flat':
      // A flat fee is per DOCUMENT, so it does not scale with the invoice — but
      // an invoice worth nothing has introduced nothing, and charging a fee on
      // it would leave commission stranded when the document is later voided.
      return baseAmount > 0 ? roundMoney(rate) : 0
  }
}

/** Human-readable rate, e.g. "1.5%" or "Rs 12/unit" — used in lists and ledgers. */
export function formatCommissionRate(type: CommissionType, rate: number): string {
  switch (type) {
    case 'percentage': return `${Number(rate)}%`
    case 'per_unit':   return `Rs ${Number(rate)}/unit`
    case 'flat':       return `Rs ${Number(rate)} flat`
    case 'none':       return '—'
  }
}
