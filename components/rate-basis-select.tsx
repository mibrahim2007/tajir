'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ITEM_FORMULAS, RATE_BASIS_LABELS, normalizeFormula, type ItemFormula } from '@/lib/item-formula'

// Rate Basis of one stock line (0074): how the line is measured and billed.
// Anything other than Qty × Rate shows the carton / weight fields and asks for
// grade and lot.
export function RateBasisSelect({
  value,
  onChange,
  className = 'h-9 w-full min-w-[8.5rem]',
  disabled = false,
}: {
  value: string | null | undefined
  onChange: (basis: ItemFormula) => void
  className?: string
  disabled?: boolean
}) {
  return (
    <Select value={normalizeFormula(value)} onValueChange={(v) => onChange(normalizeFormula(v))} disabled={disabled}>
      <SelectTrigger className={className}><SelectValue /></SelectTrigger>
      <SelectContent>
        {ITEM_FORMULAS.map((f) => <SelectItem key={f} value={f}>{RATE_BASIS_LABELS[f]}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
