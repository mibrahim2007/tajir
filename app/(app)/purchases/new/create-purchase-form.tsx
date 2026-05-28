'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/currency-input'
import { ItemPickerDialog } from '@/components/item-picker-dialog'
import { createPurchaseAction } from '@/app/actions/create-purchase'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'

const schema = z.object({
  supplierId:   z.string().min(1, 'Supplier is required'),
  stockItemId:  z.string().min(1, 'Stock item is required'),
  quantity:     z.number().positive('Quantity must be positive'),
  rate:         z.number().positive('Rate must be positive'),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.number().positive().default(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  advancePaid:  z.number().min(0).default(0),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD transactions', path: ['exchangeRate'] },
)

type FormValues = z.infer<typeof schema>

type Props = {
  today: string
  suppliers: { id: string; name: string }[]
  lots: { id: string; name: string; count: string }[]
}

export function CreatePurchaseForm({ today, suppliers, lots }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  const supplierPickerItems = suppliers.map((s) => ({ id: s.id, name: s.name }))

  const lotPickerItems = lots.map((l) => ({
    id: l.id,
    name: l.name,
    badge: l.count,
  }))

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      supplierId: '', stockItemId: '', quantity: 0, rate: 0,
      currencyCode: 'PKR', exchangeRate: 1, date: today, advancePaid: 0,
    },
  })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createPurchaseAction(values)
      if (!result.success) { setServerError(result.error); return }
      router.push('/purchases')
    })
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext} className="flex flex-col gap-4">

            {/* Supplier — popup dialog picker */}
            <FormField control={form.control} name="supplierId" render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <ItemPickerDialog
                    items={supplierPickerItems}
                    value={field.value}
                    onSelect={field.onChange}
                    placeholder="Select supplier…"
                    title="Select Supplier"
                    disabled={suppliers.length === 0}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Stock Item — popup dialog picker */}
            <FormField control={form.control} name="stockItemId" render={({ field }) => (
              <FormItem>
                <FormLabel>Stock Item <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <ItemPickerDialog
                    items={lotPickerItems}
                    value={field.value}
                    onSelect={field.onChange}
                    placeholder="Select stock item…"
                    title="Select Stock Item"
                    disabled={lots.length === 0}
                  />
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

            <FormField control={form.control} name="advancePaid" render={() => (
              <FormItem>
                <FormLabel>Advance Paid (PKR)</FormLabel>
                <FormControl><Input type="number" step="0.01" min="0" placeholder="0" {...form.register('advancePaid', { valueAsNumber: true })} /></FormControl>
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

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 min-h-[44px]" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 min-h-[44px]" disabled={isPending || suppliers.length === 0 || lots.length === 0}>
                {isPending ? 'Saving…' : 'Confirm Purchase'}
              </Button>
            </div>

            {(suppliers.length === 0 || lots.length === 0) && (
              <p className="text-xs text-muted-foreground text-center">
                {suppliers.length === 0 ? 'Add a supplier first.' : 'Add a stock item first.'}
              </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
