import { rateFraction, type BuyerType } from './scenarios'

/*
 * Line arithmetic for an FBR tax invoice, shared by the form (live totals) and
 * the server (what is stored and sent), so the two can never disagree.
 *
 *   valueSalesExcludingST = quantity × unit price − discount
 *   salesTaxApplicable    = rate × value   (or × notified retail value for 3rd Schedule goods)
 *   furtherTax            = further-tax rate × value, for Unregistered buyers on taxable lines
 *                           (can be overridden per line)
 *   totalValues           = value + sales tax + further tax + extra tax + FED
 */

export type FbrLineInput = {
  hsCode: string
  productDescription: string
  uom: string
  quantity: number
  unitPrice: number
  discount: number
  rate: string
  /** Per-unit notified / retail price — 3rd Schedule goods only. */
  retailPrice: number
  extraTax: number
  fedPayable: number
  salesTaxWithheldAtSource: number
  /** null = calculate automatically. */
  furtherTaxOverride: number | null
  sroScheduleNo: string
  sroItemSerialNo: string
}

export type FbrLineTotals = {
  valueSalesExcludingST: number
  fixedNotifiedValueOrRetailPrice: number
  salesTaxApplicable: number
  furtherTax: number
  totalValues: number
}

const r2 = (x: number) => Math.round((Number.isFinite(x) ? x : 0) * 100) / 100

export function lineTotals(
  l: FbrLineInput,
  opts: { buyer: BuyerType; furtherTaxRate: number; retailPrice: boolean },
): FbrLineTotals {
  const value = r2(l.quantity * l.unitPrice - (l.discount || 0))
  const fixed = opts.retailPrice ? r2(l.quantity * (l.retailPrice || 0)) : 0
  const rate = rateFraction(l.rate)
  const salesTax = r2((opts.retailPrice ? fixed : value) * rate)
  const autoFurther = opts.buyer === 'Unregistered' && rate > 0 ? r2(value * (opts.furtherTaxRate / 100)) : 0
  const furtherTax = l.furtherTaxOverride ?? autoFurther
  return {
    valueSalesExcludingST: value,
    fixedNotifiedValueOrRetailPrice: fixed,
    salesTaxApplicable: salesTax,
    furtherTax: r2(furtherTax),
    totalValues: r2(value + salesTax + furtherTax + (l.extraTax || 0) + (l.fedPayable || 0)),
  }
}

export function invoiceTotals(lines: FbrLineTotals[]) {
  return {
    value:      r2(lines.reduce((s, l) => s + l.valueSalesExcludingST, 0)),
    salesTax:   r2(lines.reduce((s, l) => s + l.salesTaxApplicable, 0)),
    furtherTax: r2(lines.reduce((s, l) => s + l.furtherTax, 0)),
    total:      r2(lines.reduce((s, l) => s + l.totalValues, 0)),
  }
}
