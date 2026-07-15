'use client'

import { useEffect } from 'react'
import { useFormContext, Controller } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Props = {
  amountName: string
  currencyName: string
  exchangeRateName: string
  label?: string
  required?: boolean
  // Allow a negative amount (e.g. a customer/supplier opening balance that is a
  // credit / advance). Off by default so receipts, refunds, etc. stay positive.
  allowNegative?: boolean
  // Decimal granularity of the amount input. Defaults to 2dp (money); pass a
  // finer step (e.g. '0.0001') for a per-unit rate that needs 4 decimals.
  step?: string
}

export function CurrencyInput({
  amountName,
  currencyName,
  exchangeRateName,
  label = 'Amount',
  required,
  allowNegative,
  step = '0.01',
}: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { watch, setValue, register, formState: { errors } } = useFormContext<any>()
  const currency = watch(currencyName)

  useEffect(() => {
    if (currency === 'PKR') setValue(exchangeRateName, 1)
  }, [currency, exchangeRateName, setValue])

  const amountError = errors[amountName]?.message as string | undefined
  const exRateError = errors[exchangeRateName]?.message as string | undefined

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Label>
            {label}
            {required && <span className="text-destructive"> *</span>}
          </Label>
          <Input type="number" step={step} min={allowNegative ? undefined : '0'} placeholder="0.00" {...register(amountName, { valueAsNumber: true })} />
          {amountError && <p className="text-xs text-destructive">{amountError}</p>}
        </div>

        <div className="w-28 space-y-1">
          <Label>Currency</Label>
          <Controller
            name={currencyName}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PKR">PKR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {currency === 'USD' && (
        <div className="space-y-1">
          <Label>
            Exchange Rate (1 USD = ? PKR)
            <span className="text-destructive"> *</span>
          </Label>
          <Input type="number" step="0.01" min="1" placeholder="e.g. 278.50" {...register(exchangeRateName, { valueAsNumber: true })} />
          {exRateError && <p className="text-xs text-destructive">{exRateError}</p>}
        </div>
      )}
    </div>
  )
}
