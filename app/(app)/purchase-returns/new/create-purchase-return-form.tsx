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
import { createPurchaseReturnAction } from '@/app/actions/create-purchase-return'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'

const schema = z.object({
  purchaseOrderId: z.string().optional(),
  supplierId:      z.string().min(1, 'Supplier is required'),
  stockItemId:     z.string().min(1, 'Stock item is required'),
  quantity:        z.number().positive('Quantity must be positive'),
  rate:            z.number().positive('Rate must be positive'),
  currencyCode:    z.enum(['PKR', 'USD']),
  exchangeRate:    z.number().positive().default(1),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  reason:          z.string().optional(),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD transactions', path: ['exchangeRate'] },
)

type FormValues = z.infer<typeof schema>

type PurchaseOrder = {
  id: string
  date: string
  supplierId: string
  stockItemId: string
  quantity: string
  rate: string
  currencyCode: string
}

type Props = {
  today: string
  suppliers: { id: string; name: string }[]
  lots: { id: string; name: string; count: string }[]
  purchaseOrders: PurchaseOrder[]
}

export function CreatePurchaseReturnForm({ today, suppliers, lots, purchaseOrders }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      purchaseOrderId: '', supplierId: '', stockItemId: '',
      quantity: 0, rate: 0, currencyCode: 'PKR', exchangeRate: 1, date: today, reason: '',
    },
  })

  const selectedPoId = form.watch('purchaseOrderId')

  const handlePoSelect = (poId: string) => {
    form.setValue('purchaseOrderId', poId)
    const po = purchaseOrders.find((o) => o.id === poId)
    if (po) {
      form.setValue('supplierId', po.supplierId)
      form.setValue('stockItemId', po.stockItemId)
      form.setValue('rate', parseFloat(po.rate))
      form.setValue('currencyCode', po.currencyCode as 'PKR' | 'USD')
    }
  }

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createPurchaseReturnAction({
        ...values,
        purchaseOrderId: values.purchaseOrderId || undefined,
        reason: values.reason || undefined,
      })
      if (!result.success) { setServerError(result.error); return }
      router.push('/purchase-returns')
    })
  }

  const supplierPickerItems = suppliers.map((s) => ({ id: s.id, name: s.name }))
  const lotPickerItems = lots.map((l) => ({ id: l.id, name: l.name, badge: l.count }))

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext} className="flex flex-col gap-4">

            {/* Optional: link to original purchase order */}
            <FormItem>
              <FormLabel>Against Purchase Order (optional)</FormLabel>
              <Select onValueChange={handlePoSelect} value={selectedPoId}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Select purchase order…" />
                </SelectTrigger>
                <SelectContent>
                  {purchaseOrders.map((o) => {
                    const supplier = suppliers.find((s) => s.id === o.supplierId)
                    const lot = lots.find((l) => l.id === o.stockItemId)
                    return (
                      <SelectItem key={o.id} value={o.id}>
                        {o.date} — {supplier?.name ?? '?'} — {lot?.name ?? '?'} ({o.quantity} units)
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </FormItem>

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
                  <Input placeholder="e.g. Defective goods, wrong item…" {...field} className="min-h-[44px]" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 min-h-[44px]" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 min-h-[44px] bg-green-600 hover:bg-green-700 text-white" disabled={isPending}>
                {isPending ? 'Saving…' : 'Confirm Return'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
