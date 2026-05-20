'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/currency-input'
import { editArReceiptAction } from '@/app/actions/edit-ar-receipt'

const schema = z.object({
  amount:            z.number().positive('Amount must be positive'),
  currencyCode:      z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:      z.number().positive().default(1),
  date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentMethodNote: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

type Receipt = {
  id: string
  amount: string
  currencyCode: string
  pkrEquivalent: string
  date: string
  paymentMethodNote: string | null
}

export function EditArReceiptForm({ receipt }: { receipt: Receipt }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const amount = parseFloat(receipt.amount)
  const pkrEq = parseFloat(receipt.pkrEquivalent)
  const currency = receipt.currencyCode as 'PKR' | 'USD'
  const exchangeRate = currency === 'USD' && amount > 0 ? pkrEq / amount : 1

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      amount,
      currencyCode:      currency,
      exchangeRate,
      date:              receipt.date,
      paymentMethodNote: receipt.paymentMethodNote ?? '',
    },
  })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await editArReceiptAction({ id: receipt.id, ...values })
      if (!result.success) { setError(result.error); return }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="min-h-[44px]"><Pencil className="h-4 w-4" /></Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>Edit Receipt</SheetTitle></SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
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
            <FormField control={form.control} name="paymentMethodNote" render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Method / Note</FormLabel>
                <FormControl><Input placeholder="e.g. Bank transfer, Cheque #123" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
