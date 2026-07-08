'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/currency-input'
import { createApPaymentAction } from '@/app/actions/create-ap-payment'
import { MONEY_ACCOUNTS } from '@/lib/constants/money-accounts'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'

const schema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currencyCode: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.number().positive().default(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentMethodNote: z.string().optional(),
  moneyAccount: z.enum(['cash_in_hand', 'cash_at_bank', 'post_dated_cheques']).default('cash_in_hand'),
})

type FormValues = z.infer<typeof schema>

export function RecordPaymentForm({ supplierId, today }: { supplierId: string; today: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { amount: 0, currencyCode: 'PKR', exchangeRate: 1, date: today, paymentMethodNote: '', moneyAccount: 'cash_in_hand' },
  })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createApPaymentAction({ ...values, supplierId })
      if (!result.success) { setServerError(result.error); return }
      form.reset({ amount: 0, currencyCode: 'PKR', exchangeRate: 1, date: today, paymentMethodNote: '', moneyAccount: 'cash_in_hand' })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="min-h-[44px]">Record Payment</Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Record Payment</SheetTitle>
          <SheetDescription>Record a payment made to this supplier.</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext} className="flex flex-col gap-4 mt-6">
              <CurrencyInput
                amountName="amount"
                currencyName="currencyCode"
                exchangeRateName="exchangeRate"
                label="Amount"
                required
              />

              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="moneyAccount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Paid from <span className="text-destructive">*</span></FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MONEY_ACCOUNTS.map((a) => (
                        <SelectItem key={a.value} value={a.value}>{a.label} ({a.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="paymentMethodNote" render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method / Note</FormLabel>
                  <FormControl><Input placeholder="e.g. Bank transfer, Cheque #123" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {serverError && <p className="text-sm text-destructive">{serverError}</p>}
              <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                {isPending ? 'Recording…' : 'Record Payment'}
              </Button>
            </form>
          </Form>
      </SheetContent>
    </Sheet>
  )
}
