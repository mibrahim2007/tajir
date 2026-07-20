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

// Small per-field label shown only on narrow screens (where the column header
// row is hidden and fields stack), so Bank/Amount can't be confused.
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="sm:hidden text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{children}</span>
}

// Editable split-tender table: one row per tender (Cash / PDC / Online), each
// with an optional cheque number and bank plus an amount. Reads/writes the
// `lines` field array on the surrounding react-hook-form.
export function TenderLinesField({ banks, currency = 'PKR' }: { banks: Bank[]; currency?: string }) {
  const { control, register, watch, formState } = useFormContext<{ lines: TenderLine[] }>()
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })

  const lines = watch('lines') ?? []
  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const linesError = formState.errors.lines as
    | ({ message?: string; root?: { message?: string } } & Array<{ chequeNumber?: { message?: string } } | undefined>)
    | undefined
  const rootError = linesError?.message ?? linesError?.root?.message
  // Per-line errors were previously not rendered at all, so a per-field rule
  // (e.g. cheque required for a PDC) would have blocked submit invisibly.
  const chequeError = (i: number) => linesError?.[i]?.chequeNumber?.message

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Tender Breakdown <span className="text-destructive">*</span></Label>
        <span className="text-xs text-muted-foreground">{currency !== 'PKR' ? `Amounts in ${currency}` : 'Cash · PDC · Online'}</span>
      </div>

      {/* Column headers (wide screens only). minmax(0,…) lets columns shrink so
          long bank names never push the grid past the container; Bank gets the
          most relative width since its text is longest. */}
      <div className="hidden sm:grid grid-cols-[110px_minmax(0,1fr)_minmax(0,1.6fr)_110px_36px] gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>Type</span>
        <span>Cheque No.</span>
        <span>Bank</span>
        <span className="text-right">Amount</span>
        <span />
      </div>

      <div className="space-y-3 sm:space-y-2">
        {fields.map((field, i) => {
          const type = lines[i]?.transactionType ?? 'cash'
          const chequeDisabled = type === 'cash'
          const bankDisabled   = type === 'cash'
          // A PDC is a specific physical cheque — without its number the row
          // can't be reconciled against the bank later.
          const chequeRequired = type === 'pdc'
          const chequeErr = chequeError(i)
          return (
            // Narrow: each field stacks full-width with its own label inside a
            // bordered card. Wide: aligns to the header grid above.
            <div
              key={field.id}
              className="rounded-lg border p-3 sm:border-0 sm:p-0 sm:rounded-none grid grid-cols-1 sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1.6fr)_110px_36px] gap-2 sm:items-start"
            >
              <div className="min-w-0 space-y-1">
                <FieldLabel>Type</FieldLabel>
                <Controller
                  control={control}
                  name={`lines.${i}.transactionType`}
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger className="min-h-[44px] sm:min-h-[40px] w-full min-w-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TENDER_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="min-w-0 space-y-1">
                <FieldLabel>Cheque No.{chequeRequired && <span className="text-destructive"> *</span>}</FieldLabel>
                <Input
                  placeholder={chequeDisabled ? '—' : chequeRequired ? 'Cheque No. (required)' : 'Cheque No.'}
                  disabled={chequeDisabled}
                  aria-invalid={!!chequeErr}
                  className={`min-h-[44px] sm:min-h-[40px] min-w-0 ${chequeErr ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  {...register(`lines.${i}.chequeNumber`)}
                />
                {chequeErr && <p className="text-xs text-destructive">{chequeErr}</p>}
              </div>

              <div className="min-w-0 space-y-1">
                <FieldLabel>Bank</FieldLabel>
                <Controller
                  control={control}
                  name={`lines.${i}.bankId`}
                  render={({ field: f }) => (
                    <Select value={f.value || '__none__'} onValueChange={(v) => f.onChange(v === '__none__' ? '' : v)} disabled={bankDisabled}>
                      {/* w-full overrides the trigger's default w-fit so a long bank
                          name can't grow the trigger past its column; the value span
                          is forced to a truncating block. */}
                      <SelectTrigger className="min-h-[44px] sm:min-h-[40px] w-full min-w-0 overflow-hidden [&>span]:min-w-0 [&>span]:!block [&>span]:truncate"><SelectValue placeholder="Bank" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No bank</SelectItem>
                        {banks.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}{b.account_number ? ` — ${b.account_number}` : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="min-w-0 space-y-1">
                <FieldLabel>Amount</FieldLabel>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="min-h-[44px] sm:min-h-[40px] text-right min-w-0"
                  {...register(`lines.${i}.amount`, { valueAsNumber: true })}
                />
              </div>

              <div className="flex justify-end sm:block">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-[40px] sm:h-10 sm:w-9 sm:p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => (fields.length > 1 ? remove(i) : null)}
                  disabled={fields.length <= 1}
                  title="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sm:hidden ml-1.5">Remove</span>
                </Button>
              </div>
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
