'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, FormProvider, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/currency-input'
import { createArReceiptAction } from '@/app/actions/create-ar-receipt'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

type Customer = { id: string; name: string; outstanding: number }
type Sale = { id: string; date: string; itemName: string; qty: number; pkrEquivalent: number }
type Bank = { id: string; name: string; account_number: string | null }

type Props = {
  today: string
  customers: Customer[]
  salesByCustomer: Record<string, Sale[]>
  banks: Bank[]
}

const schema = z.object({
  customerId:        z.string().uuid('Select a customer'),
  amount:            z.number().positive('Amount must be positive'),
  currencyCode:      z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:      z.number().positive().default(1),
  date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentMethodNote: z.string().optional(),
  chequeNumber:      z.string().optional(),
  bankId:            z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function CreateReceiptForm({ today, customers, salesByCustomer, banks }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { customerId: '', amount: 0, currencyCode: 'PKR', exchangeRate: 1, date: today, paymentMethodNote: '', chequeNumber: '', bankId: '' },
  })

  const selectedCustomerId = form.watch('customerId')
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)
  const customerSales = selectedCustomerId ? (salesByCustomer[selectedCustomerId] ?? []) : []

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createArReceiptAction({ ...values, chequeNumber: values.chequeNumber || undefined, bankId: values.bankId || undefined })
      if (!result.success) { setServerError(result.error); return }
      router.push('/receipts')
    })
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext} className="flex flex-col gap-5">

        {/* Customer */}
        <div className="space-y-1">
          <Label>Customer <span className="text-destructive">*</span></Label>
          <Controller
            control={form.control}
            name="customerId"
            render={({ field, fieldState }) => (
              <>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="Select customer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.outstanding > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({formatPKR(c.outstanding)} outstanding)
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldState.error && <p className="text-xs text-destructive">{fieldState.error.message}</p>}
              </>
            )}
          />
        </div>

        {/* Outstanding sales reference */}
        {selectedCustomer && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Outstanding balance</span>
              <span className={`font-semibold tabular-nums ${selectedCustomer.outstanding > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {formatPKR(selectedCustomer.outstanding)}
              </span>
            </div>
            {customerSales.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground">Invoices for reference:</p>
                <div className="space-y-1">
                  {customerSales.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatPKTDate(s.date + 'T00:00:00')} · {s.itemName} × {s.qty}</span>
                      <span className="tabular-nums">{formatPKR(s.pkrEquivalent)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <CurrencyInput
          amountName="amount"
          currencyName="currencyCode"
          exchangeRateName="exchangeRate"
          label="Amount Received"
          required
        />

        <div className="space-y-1">
          <Label>Date <span className="text-destructive">*</span></Label>
          <Input type="date" {...form.register('date')} className="min-h-[44px]" />
          {form.formState.errors.date && <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Cheque No. (optional)</Label>
            <Input placeholder="e.g. 001234" {...form.register('chequeNumber')} className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label>Note (optional)</Label>
            <Input placeholder="e.g. Bank transfer…" {...form.register('paymentMethodNote')} className="min-h-[44px]" />
          </div>
        </div>

        {banks.length > 0 && (
          <div className="space-y-1">
            <Label>Bank (optional)</Label>
            <Controller
              control={form.control}
              name="bankId"
              render={({ field }) => (
                <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="Cash / no bank" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Cash / no bank</SelectItem>
                    {banks.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}{b.account_number ? ` — ${b.account_number}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        )}

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
          {isPending ? 'Saving…' : 'Record Receipt'}
        </Button>
      </form>
    </FormProvider>
  )
}
