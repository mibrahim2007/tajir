'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ITEM_FORMULAS, FORMULA_LABELS, FORMULA_DEFAULTS, STOCK_UNITS, PACK_UNITS,
  usesCartons, type ItemFormula,
} from '@/lib/item-formula'

export type ItemTypeProfileValue = {
  formula:       ItemFormula
  stockUnit:     string | null
  packUnit:      string | null
  stdPackWeight: number | null
  trackGrade:    boolean
  trackLot:      boolean
}

export function defaultProfile(formula: ItemFormula = 'standard'): ItemTypeProfileValue {
  return { formula, ...FORMULA_DEFAULTS[formula], trackGrade: false, trackLot: false }
}

// One-line explanation of what a formula does on an invoice line.
const FORMULA_HELP: Record<ItemFormula, string> = {
  standard: 'Lines take a quantity and a rate. Amount = Qty × Rate.',
  yarn:     'Lines also show Yarn Type, Yarn Weight and Multiply By. Amount = Qty × Rate × Multiply By.',
  per_lb:   'Lines take Nos Carton and Weight (kg). Stock = Cartons × kg; the amount is billed on lbs × Rate.',
  per_kg:   'Lines take Nos Carton and Weight (kg). Stock = Cartons × kg; Amount = kg × Rate.',
  per_pack: 'Lines take the number of packs (bags). Stock = packs; Amount = packs × Rate. Weight is optional.',
}

// The formula profile of an item type: which formula its items' lines follow,
// and the units around it. Used on the item-type pages and the quick-add dialog.
export function ItemTypeProfileFields({
  value,
  onChange,
  formulaLocked = false,
  compact = false,
}: {
  value: ItemTypeProfileValue
  onChange: (next: ItemTypeProfileValue) => void
  /** Items of the type have been traded; the formula can't change any more. */
  formulaLocked?: boolean
  /** Single-column layout for dialogs. */
  compact?: boolean
}) {
  const packed = usesCartons(value.formula)
  const set = (patch: Partial<ItemTypeProfileValue>) => onChange({ ...value, ...patch })
  const span = (n: string) => (compact ? '' : n)

  return (
    <div className={compact ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-12 gap-4 items-start'}>
      <div className={`${span('md:col-span-6')} space-y-1.5`}>
        <Label>Formula <span className="text-destructive">*</span></Label>
        <Select
          value={value.formula}
          disabled={formulaLocked}
          // Picking a formula applies its template units; they stay editable.
          onValueChange={(v) => onChange({ ...value, formula: v as ItemFormula, ...FORMULA_DEFAULTS[v as ItemFormula] })}
        >
          <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ITEM_FORMULAS.map((f) => <SelectItem key={f} value={f}>{FORMULA_LABELS[f]}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {formulaLocked
            ? 'Locked: items of this type already have invoices or returns.'
            : FORMULA_HELP[value.formula]}
        </p>
      </div>

      <div className={`${span('md:col-span-3')} space-y-1.5`}>
        <Label>Stock Unit</Label>
        <Select value={value.stockUnit ?? '_none_'} onValueChange={(v) => set({ stockUnit: v === '_none_' ? null : v })}>
          <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="Select unit…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none_">No unit</SelectItem>
            {STOCK_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {packed && (
        <>
          <div className={`${span('md:col-span-3')} space-y-1.5`}>
            <Label>Pack Unit</Label>
            <Select value={value.packUnit ?? '_none_'} onValueChange={(v) => set({ packUnit: v === '_none_' ? null : v })}>
              <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="Select pack…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">Not set</SelectItem>
                {PACK_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className={`${span('md:col-span-3')} space-y-1.5`}>
            <Label>Std. Weight per {value.packUnit || 'Pack'} (kg)</Label>
            <Input
              type="number" inputMode="decimal" min={0} step="0.001" className="min-h-[44px]"
              placeholder="e.g. 33 or 45.36"
              value={value.stdPackWeight ?? ''}
              onChange={(e) => set({ stdPackWeight: e.target.value === '' ? null : Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">Pre-filled on invoice lines; can be changed per line.</p>
          </div>
        </>
      )}

      <div className={`${span('md:col-span-12')} flex flex-wrap gap-x-6 gap-y-2`}>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={value.trackGrade} onCheckedChange={(c) => set({ trackGrade: c === true })} />
          Track grade (e.g. AA-Even, A-Uneven) — every line must name one
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={value.trackLot} onCheckedChange={(c) => set({ trackLot: c === true })} />
          Track lot number — purchases get one generated when left blank
        </label>
      </div>
    </div>
  )
}
