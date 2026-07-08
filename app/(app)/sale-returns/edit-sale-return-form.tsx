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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/currency-input'
import { editSaleReturnAction } from '@/app/actions/edit-sale-return'

const schema = z.object({
  customerId:   z.string().uuid('Select a customer'),
  stockItemId:  z.string().uuid('Select a stock item'),
  quantity:     z.number().positive('Quantity must be positive'),
  rate:         z.number().positive('Rate must be positive'),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.number().positive().default(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  reason:       z.string().optional(),
  locationId:   z.string().optional(),
})

type FormValues = z.infer<typeof schema>

type SaleReturn = {
  id: string
  customerId: string
  stockItemId: string
  quantity: number
  rate: number
  currencyCode: string
  exchangeRate: number
  date: string
  reason: string | null
  locationId: string | null
}

type Props = {
  ret: SaleReturn
  customers: { id: string; name: string }[]
  lots: { id: string; name: string; unitOfMeasure: string | null }[]
  locations: { id: string; name: string }[]
}

const SELECT_CLS = 'flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function EditSaleReturnForm({ ret, customers, lots, locations }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      customerId:   ret.customerId,
      stockItemId:  ret.stockItemId,
      quantity:     ret.quantity,
      rate:         ret.rate,
      currencyCode: ret.currencyCode as 'PKR' | 'USD',
      exchangeRate: ret.exchangeRate,
      date:         ret.date,
      reason:       ret.reason ?? '',
      locationId:   ret.locationId ?? '',
    },
  })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await editSaleReturnAction({ id: ret.id, ...values })
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
        <SheetHeader><SheetTitle>Edit Sale Return</SheetTitle></SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">

            <FormField control={form.control} name="customerId" render={() => (
              <FormItem>
                <FormLabel>Customer <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <select {...form.register('customerId')} className={SELECT_CLS}>
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
                  <select {...form.register('stockItemId')} className={SELECT_CLS}>
                    {lots.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
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
                  <FormControl>
                    <Input type="number" step="0.001" min="0" value={value}
                      onFocus={(e) => e.target.select()}
                      {...form.register('quantity', { valueAsNumber: true })} />
                  </FormControl>
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

            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="reason" render={({ field }) => (
              <FormItem>
                <FormLabel>Reason</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Defective item, customer request…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {locations.length > 0 && (
              <FormField control={form.control} name="locationId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <Select
                    value={field.value || '_none_'}
                    onValueChange={(v) => field.onChange(v === '_none_' ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select location…" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none_">No location</SelectItem>
                      {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}

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
