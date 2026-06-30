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
import { editPurchaseAction } from '@/app/actions/edit-purchase'

const schema = z.object({
  supplierId:   z.string().min(1, 'Supplier is required'),
  stockItemId:  z.string().min(1, 'Stock item is required'),
  quantity:     z.number().positive('Quantity must be positive'),
  rate:         z.number().positive('Rate must be positive'),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.number().positive().default(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  advancePaid:  z.number().min(0).default(0),
})

type FormValues = z.infer<typeof schema>

type Purchase = {
  id: string
  supplierId: string
  stockItemId: string
  quantity: string
  rate: string
  currencyCode: string
  exchangeRate: string
  advancePaid: string
  date: string
}

type Props = {
  purchase: Purchase
  suppliers: { id: string; name: string }[]
  lots: { id: string; name: string; count: string; unitOfMeasure: string | null }[]
}

export function EditPurchaseForm({ purchase, suppliers, lots }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      supplierId:   purchase.supplierId,
      stockItemId:  purchase.stockItemId,
      quantity:     parseFloat(purchase.quantity),
      rate:         parseFloat(purchase.rate),
      currencyCode: purchase.currencyCode as 'PKR' | 'USD',
      exchangeRate: parseFloat(purchase.exchangeRate),
      date:         purchase.date,
      advancePaid:  parseFloat(purchase.advancePaid),
    },
  })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await editPurchaseAction({ id: purchase.id, ...values })
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
        <SheetHeader><SheetTitle>Edit Purchase</SheetTitle></SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
            <FormField control={form.control} name="supplierId" render={() => (
              <FormItem>
                <FormLabel>Supplier <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <select
                    {...form.register('supplierId')}
                    className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                    {lots.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.count})</option>)}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="quantity" render={({ field: { value } }) => {
              const uom = lots.find(l => l.id === form.watch('stockItemId'))?.unitOfMeasure
              return (
                <FormItem>
                  <FormLabel>Quantity <span className="text-destructive">*</span>{uom && <span className="ml-1 text-muted-foreground font-normal">({uom})</span>}</FormLabel>
                  <FormControl><Input type="number" step="0.001" min="0" value={value} {...form.register('quantity', { valueAsNumber: true })} /></FormControl>
                  <FormMessage />
                </FormItem>
              )
            }} />

            <CurrencyInput
              amountName="rate"
              currencyName="currencyCode"
              exchangeRateName="exchangeRate"
              label="Rate per Unit"
              required
            />

            <FormField control={form.control} name="advancePaid" render={() => (
              <FormItem>
                <FormLabel>Advance Paid (PKR)</FormLabel>
                <FormControl><Input type="number" step="0.01" min="0" {...form.register('advancePaid', { valueAsNumber: true })} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
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
