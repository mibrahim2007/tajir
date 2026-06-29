'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ItemPickerDialog, type PickerItem } from '@/components/item-picker-dialog'
import { QuickCreateCustomer, QuickCreateLot } from '@/components/quick-create-forms'
import { setPricingRuleAction } from '@/app/actions/set-pricing-rule'

type Customer  = { id: string; name: string }
type StockItem = { id: string; name: string }

const schema = z.object({
  customerId:  z.string().uuid('Select a customer'),
  stockItemId: z.string().uuid('Select a stock item'),
  rate:        z.number().positive('Rate must be positive'),
})

type FormValues = z.infer<typeof schema>

export function SetPriceForm({ customers, stockItems }: { customers: Customer[]; stockItems: StockItem[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
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

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await setPricingRuleAction(values)
      if (!result.success) { setServerError(result.error); return }
      form.reset()
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="min-h-[44px]"><Tag className="h-4 w-4 mr-2" />Set Price</Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Set Customer Price</SheetTitle>
          <SheetDescription>Set a custom rate for a customer and stock item. Any existing price for the same pair will be superseded.</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
            <FormField control={form.control} name="customerId" render={({ field }) => (
              <FormItem>
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
              <FormItem>
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
              <FormItem>
                <FormLabel>Rate (PKR / unit) <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input type="number" min={0} step="0.01" placeholder="0.00"
                    {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
              {isPending ? 'Saving…' : 'Set Price'}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
