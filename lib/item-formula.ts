// Rate basis of a stock line, shared by the trading forms, server actions and
// prints. Each purchase / sale / return / opening-stock line carries its own
// `rate_basis` (migration 0074); the item type's stored formula is only the
// default for an item that has never been traded.
//
//   standard  amount = qty × rate
//   yarn      amount = qty × rate × multiply_by, plus the yarn fields
//   per_lb    Nos Carton × Weight (kg) = stock qty; QTY LBS drives the amount
//   per_kg    Nos Carton × Weight (kg) = stock qty; amount = kg × rate
//   per_pack  Nos Carton (packs) = stock qty;       amount = packs × rate

import { computeQtyLbs } from '@/lib/polyester'

export const ITEM_FORMULAS = ['standard', 'yarn', 'per_lb', 'per_kg', 'per_pack'] as const
export type ItemFormula = (typeof ITEM_FORMULAS)[number]

export const FORMULA_LABELS: Record<ItemFormula, string> = {
  standard: 'Count item — Qty × Rate',
  yarn:     'Yarn — Qty × Rate × Multiply By',
  per_lb:   'Weighed, rate per lb — Cartons × kg → lbs × Rate',
  per_kg:   'Weighed, rate per kg — Cartons × kg × Rate',
  per_pack: 'Packed, rate per pack — Packs × Rate',
}

// Labels for the Rate Basis list on a line.
export const RATE_BASIS_LABELS: Record<ItemFormula, string> = {
  standard: 'Qty × Rate',
  yarn:     'Yarn (× Multiply)',
  per_lb:   'Per lb',
  per_kg:   'Per kg',
  per_pack: 'Per bag / pack',
}

// Grade and lot are required on weighed / packed / yarn lines; a plain
// Qty × Rate line (count items) never asks for them.
export function tracksGradeLot(basis?: ItemFormula | null): boolean {
  return !!basis && basis !== 'standard'
}

// Short label for tables and summaries.
export const FORMULA_SHORT: Record<ItemFormula, string> = {
  standard: 'Qty × Rate',
  yarn:     'Yarn',
  per_lb:   'Per lb',
  per_kg:   'Per kg',
  per_pack: 'Per pack',
}

// Template defaults applied when the user picks a formula on the item-type form.
export const FORMULA_DEFAULTS: Record<ItemFormula, { stockUnit: string; packUnit: string | null; stdPackWeight: number | null }> = {
  standard: { stockUnit: 'Piece', packUnit: null,     stdPackWeight: null },
  yarn:     { stockUnit: 'KG',    packUnit: null,     stdPackWeight: null },
  per_lb:   { stockUnit: 'KG',    packUnit: 'Carton', stdPackWeight: null },
  per_kg:   { stockUnit: 'KG',    packUnit: 'Carton', stdPackWeight: null },
  per_pack: { stockUnit: 'Bag',   packUnit: 'Bag',    stdPackWeight: null },
}

export const STOCK_UNITS = ['Piece', 'KG', 'Cone', 'Meter', 'Yard', 'Roll', 'Bag', 'Bale', 'Bundle', 'Carton'] as const
export const PACK_UNITS = ['Carton', 'Bag', 'Cone', 'Bale', 'Bundle', 'Roll'] as const

// Pre-selection for a new type typed by name, matching the old name rules. The
// user still confirms it; only the chosen formula is saved.
export function suggestFormula(typeName?: string | null): ItemFormula {
  const n = (typeName ?? '').trim().toLowerCase()
  if (n.includes('polyester') || n.includes('ployester')) return 'per_lb'
  if (n === 'yarn') return 'yarn'
  return 'standard'
}

export function normalizeFormula(value: unknown): ItemFormula {
  return (ITEM_FORMULAS as readonly string[]).includes(value as string) ? (value as ItemFormula) : 'standard'
}

// Lines of these formulas show the Nos Carton / Weight columns.
export function usesCartons(formula?: ItemFormula | null): boolean {
  return formula === 'per_lb' || formula === 'per_kg' || formula === 'per_pack'
}

// Weight per carton is required for these (it drives stock and/or the amount).
export function needsWeight(formula?: ItemFormula | null): boolean {
  return formula === 'per_lb' || formula === 'per_kg'
}

export function usesYarnFields(formula?: ItemFormula | null): boolean {
  return formula === 'yarn'
}

type LineMeasure = {
  quantity?: number | null
  nosCarton?: number | null
  weightPerCarton?: number | null
  multiplyBy?: number | null
}

// Stock quantity of a carton line, derived from its cartons / weight. Returns
// null for formulas where the user types the quantity directly.
export function cartonStockQty(formula: ItemFormula | null | undefined, l: LineMeasure): number | null {
  const cartons = Number(l.nosCarton) || 0
  if (formula === 'per_lb' || formula === 'per_kg') return cartons * (Number(l.weightPerCarton) || 0)
  if (formula === 'per_pack') return cartons
  return null
}

// QTY LBS stored on the line (per_lb only).
export function lineQtyLbs(formula: ItemFormula | null | undefined, l: LineMeasure): number | null {
  return formula === 'per_lb' ? computeQtyLbs(l.nosCarton, l.weightPerCarton) : null
}

// The quantity the rate is applied to.
export function billingQty(formula: ItemFormula | null | undefined, l: LineMeasure): number {
  switch (formula) {
    case 'per_lb':   return computeQtyLbs(l.nosCarton, l.weightPerCarton)
    case 'per_kg':   return (Number(l.nosCarton) || 0) * (Number(l.weightPerCarton) || 0)
    case 'per_pack': return Number(l.nosCarton) || 0
    default:         return Number(l.quantity) || 0
  }
}

// What the billing quantity is counted in, for column headers and prints.
export function billingUnitLabel(formula: ItemFormula | null | undefined, packUnit?: string | null): string {
  switch (formula) {
    case 'per_lb':   return 'lbs'
    case 'per_kg':   return 'kg'
    case 'per_pack': return packUnit || 'packs'
    default:         return 'qty'
  }
}

// Pre-discount line amount in the line currency × `fx`.
export function lineGrossAmount(formula: ItemFormula | null | undefined, l: LineMeasure, rate: number, fx = 1): number {
  const mult = formula === 'yarn' ? (Number(l.multiplyBy) > 0 ? Number(l.multiplyBy) : 1) : 1
  return billingQty(formula, l) * rate * fx * mult
}
