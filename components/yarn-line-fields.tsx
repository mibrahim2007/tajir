'use client'

import { Controller, useFormContext } from 'react-hook-form'
import { NumericInput } from '@/components/numeric-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { YARN_TYPES } from '@/lib/yarn'

// The three yarn-only line fields (Yarn Type, Yarn Weight, Multiply By), rendered
// as an inline panel beneath a line row. Shown only for yarn items; Multiply By
// scales the line amount. Binds to the surrounding react-hook-form via
// useFormContext at `lines.<index>.{yarnType,yarnWeight,multiplyBy}`.
export function YarnLineFields({ index }: { index: number }) {
  const { control, register } = useFormContext()

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-amber-200/70 bg-amber-50/60 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 self-center">Yarn</span>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-muted-foreground">Yarn Type</label>
        <Controller
          control={control}
          name={`lines.${index}.yarnType`}
          render={({ field }) => (
            <Select value={field.value || ''} onValueChange={field.onChange}>
              <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Type…" /></SelectTrigger>
              <SelectContent>
                {YARN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-muted-foreground">Yarn Weight</label>
        <NumericInput step="0.001" min={0} placeholder="0.000" className="h-9 w-28 text-right"
          {...register(`lines.${index}.yarnWeight`, { valueAsNumber: true })} />
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-muted-foreground">Multiply By</label>
        <NumericInput step="0.0001" min={0} placeholder="1" className="h-9 w-28 text-right"
          {...register(`lines.${index}.multiplyBy`, { valueAsNumber: true })} />
      </div>
    </div>
  )
}
