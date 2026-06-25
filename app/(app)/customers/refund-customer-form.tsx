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
import { createCustomerRefundAction } from '@/app/actions/create-customer-refund'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'

const schema = z.object({
  amount:        z.number().positive('Amount must be positive'),
  currencyCode:  z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:  z.number().positive().default(1),
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentMethod: z.enum(['cash', 'bank_transfer']),
  notes:         z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function RefundCustomerForm({ customerId, today, creditAmount }: {
  customerId:   string
  today:        string
  creditAmount: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { amount: 0, currencyCode: 'PKR', exchangeRate: 1, date: today, paymentMethod: 'cash', notes: '' },
  })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createCustomerRefundAction({ ...values, customerId })
      if (!result.success) { setServerError(result.error); return }
      form.reset({ amount: 0, currencyCode: 'PKR', exchangeRate: 1, date: today, paymentMethod: 'cash', notes: '' })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="min-h-[44px] border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40">
          Issue Refund
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Issue Customer Refund</SheetTitle>
          <SheetDescription>
            Pay back PKR {creditAmount.toLocaleString('en-PK', { maximumFractionDigits: 0 })} credit to this customer.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext} className="flex flex-col gap-4 mt-6">

            <CurrencyInput
              amountName="amount"
              currencyName="currencyCode"
              exchangeRateName="exchangeRate"
              label="Refund Amount"
            />

            <FormField control={form.control} name="paymentMethod" render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Method <span className="text-destructive">*</span></FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (optional)</FormLabel>
                <FormControl><Input placeholder="e.g. Refund for SR-0012…" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}

            <Button type="submit" className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isPending}>
              {isPending ? 'Processing…' : 'Confirm Refund'}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
