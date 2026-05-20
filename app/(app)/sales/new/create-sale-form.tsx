'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CurrencyInput } from '@/components/currency-input'
import { createSaleOrderAction } from '@/app/actions/create-sale-order'
import { formatPKR } from '@/lib/utils/currency'

type Customer = { id: string; name: string }
type StockItem = { id: string; name: string; currentQuantity: string }
type PricingRule = { customerId: string; stockItemId: string; rate: string }

const schema = z.object({
  customerId: z.string().uuid('Select a customer'),
  stockItemId: z.string().uuid('Select a stock item'),
  quantity: z.number().positive('Quantity must be positive'),
  rate: z.number().positive('Rate must be positive'),
  currencyCode: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.number().positive().default(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

type OversellPending = { available: number; requested: number; values: FormValues }

export function CreateSaleForm({
  customers,
  stockItems,
  pricingRules,
  isOwner,
}: {
  customers: Customer[]
  stockItems: StockItem[]
  pricingRules: PricingRule[]
  isOwner: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [oversellPending, setOversellPending] = useState<OversellPending | null>(null)

  const today = new Date().toISOString().split('T')[0]

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      customerId: '',
      stockItemId: '',
      quantity: 0,
      rate: 0,
      currencyCode: 'PKR',
      exchangeRate: 1,
      date: today,
      paymentDueDate: '',
    },
  })

  const watchedCustomer = form.watch('customerId')
  const watchedItem = form.watch('stockItemId')

  const selectedItem = stockItems.find((s) => s.id === watchedItem)
  const available = selectedItem ? parseFloat(selectedItem.currentQuantity) : null

  const autoPopulateRate = (customerId: string, stockItemId: string) => {
    const rule = pricingRules.find((r) => r.customerId === customerId && r.stockItemId === stockItemId)
    if (rule) form.setValue('rate', parseFloat(rule.rate))
  }

  const submit = (values: FormValues, allowOversell = false) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createSaleOrderAction({ ...values, allowOversell })
      if (!result.success) {
        if (result.code === 'OVERSELL' && 'available' in result) {
          setOversellPending({ available: result.available, requested: result.requested, values })
          return
        }
        if ('error' in result) setServerError(result.error)
        return
      }
      form.reset({ customerId: '', stockItemId: '', quantity: 0, rate: 0, currencyCode: 'PKR', exchangeRate: 1, date: today, paymentDueDate: '' })
      router.push('/sales')
    })
  }

  const onSubmit = (values: FormValues) => submit(values, false)

  const confirmOversell = () => {
    if (!oversellPending) return
    const { values } = oversellPending
    setOversellPending(null)
    submit(values, true)
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <FormField control={form.control} name="customerId" render={({ field }) => (
            <FormItem>
              <FormLabel>Customer <span className="text-destructive">*</span></FormLabel>
              <Select
                onValueChange={(v) => { field.onChange(v); autoPopulateRate(v, watchedItem) }}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select customer" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="stockItemId" render={({ field }) => (
            <FormItem>
              <FormLabel>Stock Item <span className="text-destructive">*</span></FormLabel>
              <Select
                onValueChange={(v) => { field.onChange(v); autoPopulateRate(watchedCustomer, v) }}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select item" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {stockItems.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} <span className="text-muted-foreground ml-1">({parseFloat(s.currentQuantity).toLocaleString()} avail.)</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {available !== null && (
                <p className="text-xs text-muted-foreground mt-1">Available: {available.toLocaleString()} units</p>
              )}
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="quantity" render={({ field }) => (
            <FormItem>
              <FormLabel>Quantity <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  placeholder="0"
                  {...field}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <CurrencyInput
            amountName="rate"
            currencyName="currencyCode"
            exchangeRateName="exchangeRate"
            label="Rate (per unit)"
          />

          <FormField control={form.control} name="date" render={({ field }) => (
            <FormItem>
              <FormLabel>Sale Date <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="paymentDueDate" render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Due Date (optional)</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
            {isPending ? 'Creating…' : 'Create Sale'}
          </Button>
        </form>
      </Form>

      {/* Oversell confirmation — owner only */}
      {isOwner && (
        <Dialog open={!!oversellPending} onOpenChange={() => setOversellPending(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Insufficient Stock</DialogTitle>
              <DialogDescription>
                Only <strong>{oversellPending?.available.toLocaleString()}</strong> units available,
                but <strong>{oversellPending?.requested.toLocaleString()}</strong> requested (shortfall of{' '}
                <strong>{((oversellPending?.requested ?? 0) - (oversellPending?.available ?? 0)).toLocaleString()}</strong> units).
                <br /><br />
                As owner, you can override this limit. The inventory will go negative.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOversellPending(null)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmOversell}>Override &amp; Confirm Sale</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Assistant sees a plain error — no override option */}
      {!isOwner && (
        <Dialog open={!!oversellPending} onOpenChange={() => setOversellPending(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Insufficient Stock</DialogTitle>
              <DialogDescription>
                Only <strong>{oversellPending?.available.toLocaleString()}</strong> units available,
                but <strong>{oversellPending?.requested.toLocaleString()}</strong> requested.
                <br /><br />
                Please reduce the quantity or ask the owner to proceed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOversellPending(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
