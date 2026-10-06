'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ItemPickerDialog, type PickerItem } from '@/components/item-picker-dialog'
import { QuickCreateCustomer, QuickCreateLot } from '@/components/quick-create-forms'
import { setPricingRuleAction } from '@/app/actions/set-pricing-rule'
import { formatPKR } from '@/lib/utils/currency'

type Customer  = { id: string; name: string }
type StockItem = { id: string; name: string }

const schema = z.object({
  customerId:  z.string().uuid('Select a customer'),
  stockItemId: z.string().uuid('Select a stock item'),
  rate:        z.number().positive('Rate must be positive'),
})

type FormValues = z.infer<typeof schema>

// Full-page form at /pricing/new (was a drawer on the pricing list).
export function SetPriceForm({ customers, stockItems }: { customers: Customer[]; stockItems: StockItem[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const [customerList, setCustomerList] = useState<PickerItem[]>(
    customers.map((c) => ({ id: c.id, name: c.name }))
  )
  const [lotList, setLotList] = useState<PickerItem[]>(
    stockItems.map((s) => ({ id: s.id, name: s.name }))
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { customerId: '', stockItemId: '', rate: 0 },
  })

  const watched = form.watch()
  const customerName = customerList.find((c) => c.id === watched.customerId)?.name
  const itemName = lotList.find((s) => s.id === watched.stockItemId)?.name

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await setPricingRuleAction(values)
      if (!result.success) { setServerError(result.error); return }
      // Back to the list, which re-renders with the new rule. No
      // router.refresh() inside the transition — it keeps isPending stuck.
      router.push('/pricing')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

          {/* ── FORM (left on xl) ── */}
          <Card className="min-w-0">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base">Price Details</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              <FormField control={form.control} name="customerId" render={({ field }) => (
                <FormItem className="md:col-span-6">
                  <FormLabel>Customer <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <ItemPickerDialog
                      items={customerList}
                      value={field.value}
                      onSelect={field.onChange}
                      placeholder="Select customer…"
                      title="Select Customer"
                      createLabel="New Customer"
                      onCreateSuccess={(item) => setCustomerList((prev) => [...prev, item])}
                      quickCreate={(onSuccess, onCancel) => (
                        <QuickCreateCustomer onSuccess={onSuccess} onCancel={onCancel} />
                      )}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="stockItemId" render={({ field }) => (
                <FormItem className="md:col-span-6">
                  <FormLabel>Stock Item <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <ItemPickerDialog
                      items={lotList}
                      value={field.value}
                      onSelect={field.onChange}
                      placeholder="Select stock item…"
                      title="Select Stock Item"
                      createLabel="New Stock Item"
                      onCreateSuccess={(item) => setLotList((prev) => [...prev, item])}
                      quickCreate={(onSuccess, onCancel) => (
                        <QuickCreateLot onSuccess={onSuccess} onCancel={onCancel} />
                      )}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="rate" render={({ field }) => (
                <FormItem className="md:col-span-4">
                  <FormLabel>Rate (PKR / unit) <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step="0.01" placeholder="0.00"
                      {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <p className="md:col-span-12 text-xs text-muted-foreground">
                Any existing price for the same customer and stock item will be superseded.
              </p>
            </CardContent>
          </Card>

          {/* ── SUMMARY (right on xl, sticky) ── */}
          <div className="xl:sticky xl:top-6">
            <Card>
              <CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Price Summary</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-medium text-right truncate">{customerName ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Stock Item</span>
                    <span className="text-right truncate">{itemName ?? '—'}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between gap-3 mb-5 text-sm">
                  <span className="text-muted-foreground">Rate / unit</span>
                  <span className="font-semibold tabular-nums">
                    {Number.isFinite(watched.rate) && watched.rate > 0 ? formatPKR(watched.rate) : '—'}
                  </span>
                </div>

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                    {isPending ? 'Saving…' : 'Set Price'}
                  </Button>
                  <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.push('/pricing')}>
                    Cancel
                  </Button>
                </div>

                {serverError && <p className="text-sm text-destructive mt-3">{serverError}</p>}
              </CardContent>
            </Card>
          </div>

        </div>
      </form>
    </Form>
  )
}
