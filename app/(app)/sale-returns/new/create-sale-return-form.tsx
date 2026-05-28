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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ItemPickerDialog } from '@/components/item-picker-dialog'
import { CurrencyInput } from '@/components/currency-input'
import { createSaleReturnAction } from '@/app/actions/create-sale-return'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'

const schema = z.object({
  saleOrderId:  z.string().optional(),
  customerId:   z.string().min(1, 'Customer is required'),
  stockItemId:  z.string().min(1, 'Stock item is required'),
  quantity:     z.number().positive('Quantity must be positive'),
  rate:         z.number().positive('Rate must be positive'),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.number().positive().default(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  reason:       z.string().optional(),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD transactions', path: ['exchangeRate'] },
)

type FormValues = z.infer<typeof schema>

type SaleOrder = {
  id: string
  date: string
  customerId: string
  stockItemId: string
  quantity: string
  rate: string
  currencyCode: string
}

type Props = {
  today: string
  customers: { id: string; name: string }[]
  lots: { id: string; name: string; count: string }[]
  saleOrders: SaleOrder[]
}

export function CreateSaleReturnForm({ today, customers, lots, saleOrders }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      saleOrderId: '', customerId: '', stockItemId: '',
      quantity: 0, rate: 0, currencyCode: 'PKR', exchangeRate: 1, date: today, reason: '',
    },
  })

  const selectedSoId = form.watch('saleOrderId')

  const handleSoSelect = (soId: string) => {
    form.setValue('saleOrderId', soId)
    const so = saleOrders.find((o) => o.id === soId)
    if (so) {
      form.setValue('customerId', so.customerId)
      form.setValue('stockItemId', so.stockItemId)
      form.setValue('rate', parseFloat(so.rate))
      form.setValue('currencyCode', so.currencyCode as 'PKR' | 'USD')
    }
  }

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createSaleReturnAction({
        ...values,
        saleOrderId: values.saleOrderId || undefined,
        reason: values.reason || undefined,
      })
      if (!result.success) { setServerError(result.error); return }
      router.push('/sale-returns')
    })
  }

  const customerPickerItems = customers.map((c) => ({ id: c.id, name: c.name }))
  const lotPickerItems = lots.map((l) => ({ id: l.id, name: l.name, badge: l.count }))

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext} className="flex flex-col gap-4">

            <FormItem>
              <FormLabel>Against Sale Order (optional)</FormLabel>
              <Select onValueChange={handleSoSelect} value={selectedSoId}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Select sale order…" />
                </SelectTrigger>
                <SelectContent>
                  {saleOrders.map((o) => {
                    const customer = customers.find((c) => c.id === o.customerId)
                    const lot = lots.find((l) => l.id === o.stockItemId)
                    return (
                      <SelectItem key={o.id} value={o.id}>
                        {o.date} — {customer?.name ?? '?'} — {lot?.name ?? '?'} ({o.quantity} units)
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </FormItem>

            <FormField control={form.control} name="customerId" render={({ field }) => (
              <FormItem>
                <FormLabel>Customer <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <ItemPickerDialog
                    items={customerPickerItems}
                    value={field.value}
                    onSelect={field.onChange}
                    placeholder="Select customer…"
                    title="Select Customer"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

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
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="quantity" render={() => (
              <FormItem>
                <FormLabel>Return Quantity <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input type="number" step="0.001" min="0" {...form.register('quantity', { valueAsNumber: true })} />
                </FormControl>
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

            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel>Return Date <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="reason" render={({ field }) => (
              <FormItem>
                <FormLabel>Reason</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Damaged, wrong item, quality issue…" {...field} className="min-h-[44px]" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 min-h-[44px]" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 min-h-[44px]" disabled={isPending}>
                {isPending ? 'Saving…' : 'Confirm Return'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
