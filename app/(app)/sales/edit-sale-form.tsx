'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/currency-input'
import { editSaleAction } from '@/app/actions/edit-sale'

const schema = z.object({
  customerId:     z.string().min(1, 'Customer is required'),
  stockItemId:    z.string().min(1, 'Stock item is required'),
  quantity:       z.number().positive('Quantity must be positive'),
  rate:           z.number().positive('Rate must be positive'),
  currencyCode:   z.enum(['PKR', 'USD']),
  exchangeRate:   z.number().positive().default(1),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

type FormValues = z.infer<typeof schema>

type Sale = {
  id: string
  customerId: string
  stockItemId: string
  quantity: string
  rate: string
  currencyCode: string
  exchangeRate: string
  date: string
  paymentDueDate: string | null
}

type Props = {
  sale: Sale
  customers: { id: string; name: string }[]
  lots: { id: string; name: string }[]
  costMap: Record<string, number>
}

export function EditSaleForm({ sale, customers, lots, costMap }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      customerId:     sale.customerId,
      stockItemId:    sale.stockItemId,
      quantity:       parseFloat(sale.quantity),
      rate:           parseFloat(sale.rate),
      currencyCode:   sale.currencyCode as 'PKR' | 'USD',
      exchangeRate:   parseFloat(sale.exchangeRate),
      date:           sale.date,
      paymentDueDate: sale.paymentDueDate ?? undefined,
    },
  })

  const watchedStockItemId = form.watch('stockItemId')
  const watchedRate        = form.watch('rate')
  const watchedER          = form.watch('exchangeRate')
  const cost               = costMap[watchedStockItemId]
  const belowCost          = cost !== undefined && watchedRate > 0 && (watchedRate * (watchedER || 1)) < cost

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await editSaleAction({ id: sale.id, ...values })
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
        <SheetHeader><SheetTitle>Edit Sale</SheetTitle></SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
            <FormField control={form.control} name="customerId" render={() => (
              <FormItem>
                <FormLabel>Customer <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <select
                    {...form.register('customerId')}
                    className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="stockItemId" render={() => (
              <FormItem>
                <FormLabel>Stock Item <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <select
                    {...form.register('stockItemId')}
                    className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {lots.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="quantity" render={() => (
              <FormItem>
                <FormLabel>Quantity <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="number" step="0.001" min="0" {...form.register('quantity', { valueAsNumber: true })} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <CurrencyInput
              amountName="rate"
              currencyName="currencyCode"
              exchangeRateName="exchangeRate"
              label="Rate per Unit"
              required
            />
            {belowCost && (
              <p className="text-xs text-amber-600 dark:text-amber-400 -mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Below purchase cost (Rs {Math.round(cost!).toLocaleString()})
              </p>
            )}

            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="paymentDueDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Due Date</FormLabel>
                <FormControl><Input type="date" className="min-h-[44px]" {...field} value={field.value ?? ''} /></FormControl>
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
