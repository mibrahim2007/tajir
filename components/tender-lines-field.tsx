'use client'

import { useFieldArray, useFormContext, Controller } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TENDER_TYPES } from '@/lib/constants/tender-types'
import { formatPKR } from '@/lib/utils/currency'

export type TenderLine = {
  transactionType: 'cash' | 'pdc' | 'online'
  chequeNumber:    string
  bankId:          string
  amount:          number
}

type Bank = { id: string; name: string; account_number: string | null }

// Editable split-tender table: one row per tender (Cash / PDC / Online), each
// with an optional cheque number and bank plus an amount. Reads/writes the
// `lines` field array on the surrounding react-hook-form.
export function TenderLinesField({ banks, currency = 'PKR' }: { banks: Bank[]; currency?: string }) {
  const { control, register, watch, formState } = useFormContext<{ lines: TenderLine[] }>()
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })

  const lines = watch('lines') ?? []
  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const rootError = (formState.errors.lines as { message?: string } | undefined)?.message

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Tender Breakdown <span className="text-destructive">*</span></Label>
        <span className="text-xs text-muted-foreground">{currency !== 'PKR' ? `Amounts in ${currency}` : 'Cash · PDC · Online'}</span>
      </div>

      {/* Column headers (desktop) */}
      <div className="hidden sm:grid grid-cols-[120px_1fr_1fr_120px_36px] gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>Type</span>
        <span>Cheque No.</span>
        <span>Bank</span>
        <span className="text-right">Amount</span>
        <span />
      </div>

      <div className="space-y-2">
        {fields.map((field, i) => {
          const type = lines[i]?.transactionType ?? 'cash'
          const chequeDisabled = type === 'cash'
          const bankDisabled   = type === 'cash'
          return (
            <div key={field.id} className="grid grid-cols-2 sm:grid-cols-[120px_1fr_1fr_120px_36px] gap-2 items-start">
              <Controller
                control={control}
                name={`lines.${i}.transactionType`}
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger className="min-h-[44px] sm:min-h-[40px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TENDER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />

              <Input
                placeholder={chequeDisabled ? '—' : 'Cheque No.'}
                disabled={chequeDisabled}
                className="min-h-[44px] sm:min-h-[40px]"
                {...register(`lines.${i}.chequeNumber`)}
              />

              <Controller
                control={control}
                name={`lines.${i}.bankId`}
                render={({ field: f }) => (
                  <Select value={f.value || '__none__'} onValueChange={(v) => f.onChange(v === '__none__' ? '' : v)} disabled={bankDisabled}>
                    <SelectTrigger className="min-h-[44px] sm:min-h-[40px]"><SelectValue placeholder="Bank" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No bank</SelectItem>
                      {banks.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}{b.account_number ? ` — ${b.account_number}` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />

              <Input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0.00"
                className="min-h-[44px] sm:min-h-[40px] text-right"
                {...register(`lines.${i}.amount`, { valueAsNumber: true })}
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 sm:h-10 sm:w-9 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => (fields.length > 1 ? remove(i) : null)}
                disabled={fields.length <= 1}
                title="Remove line"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[40px]"
          onClick={() => append({ transactionType: 'cash', chequeNumber: '', bankId: '', amount: 0 })}
        >
          <Plus className="h-4 w-4 mr-1" /> Add Line
        </Button>
        <div className="text-sm">
          <span className="text-muted-foreground mr-2">Total</span>
          <span className="font-semibold tabular-nums">{currency !== 'PKR' ? `${currency} ${total.toLocaleString()}` : formatPKR(total)}</span>
        </div>
      </div>

      {rootError && <p className="text-xs text-destructive">{rootError}</p>}
    </div>
  )
}
