'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CurrencyInput } from '@/components/currency-input'
import { editSaleAction } from '@/app/actions/edit-sale'
import { formatCurrency, formatPKR } from '@/lib/utils/currency'

const schema = z.object({
  customerId:     z.string().min(1, 'Customer is required'),
  stockItemId:    z.string().min(1, 'Stock item is required'),
  quantity:       z.number().positive('Quantity must be positive'),
  rate:           z.number().positive('Rate must be positive'),
  currencyCode:   z.enum(['PKR', 'USD']),
  exchangeRate:   z.number().positive().default(1),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  locationId:     z.string().optional(),
})

type FormValues = z.infer<typeof schema>

type Sale = {
  id: string
  customerId: string
  stockItemId: string
  quantity: number
  rate: number
  currencyCode: string
  exchangeRate: number
  date: string
  paymentDueDate: string | null
  locationId: string | null
}

type Props = {
  sale: Sale
  customers: { id: string; name: string }[]
  lots: { id: string; name: string; unitOfMeasure: string | null }[]
  locations: { id: string; name: string }[]
  costMap: Record<string, number>
}

// Full-page form at /sales/[id]/edit (was a row drawer on the sales list).
export function EditSaleForm({ sale, customers, lots, locations, costMap }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmBelowCost, setConfirmBelowCost] = useState<FormValues | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      customerId:     sale.customerId,
      stockItemId:    sale.stockItemId,
      quantity:       sale.quantity,
      rate:           sale.rate,
      currencyCode:   sale.currencyCode as 'PKR' | 'USD',
      exchangeRate:   sale.exchangeRate,
      date:           sale.date,
      paymentDueDate: sale.paymentDueDate ?? undefined,
      locationId:     sale.locationId ?? '',
    },
  })

  const watchedStockItemId = form.watch('stockItemId')
  const watchedRate        = form.watch('rate')
  const watchedER          = form.watch('exchangeRate')
  const cost               = costMap[watchedStockItemId]
  const belowCost          = cost !== undefined && watchedRate > 0 && (watchedRate * (watchedER || 1)) < cost

  // Summary values (display only)
  const watchedCustomerId = form.watch('customerId')
  const watchedQty        = Number(form.watch('quantity')) || 0
  const watchedCurrency   = form.watch('currencyCode')
  const watchedDate       = form.watch('date')
  const watchedDueDate    = form.watch('paymentDueDate')
  const selectedLot       = lots.find((l) => l.id === watchedStockItemId)
  const customerName      = customers.find((c) => c.id === watchedCustomerId)?.name
  const rateNum           = Number(watchedRate) || 0
  const lineAmount        = watchedQty * rateNum
  const totalPKR          = lineAmount * (watchedCurrency === 'USD' ? (Number(watchedER) || 1) : 1)

  const save = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await editSaleAction({ id: sale.id, ...values })
      if (!result.success) { setError(result.error); return }
      // Back to the list, which re-renders with the change. No
      // router.refresh() inside the transition — it keeps isPending stuck.
      router.push('/sales')
    })
  }

  const onSubmit = (values: FormValues) => {
    const c = costMap[values.stockItemId]
    const ratePKR = values.rate * (values.exchangeRate || 1)
    if (c !== undefined && values.rate > 0 && ratePKR < c) {
      setConfirmBelowCost(values)
      return
    }
    save(values)
  }

  return (
    <>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
            <Card className="min-w-0">
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-base">Sale Details</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <FormField control={form.control} name="customerId" render={() => (
              <FormItem className="md:col-span-6">
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
              <FormItem className="md:col-span-6">
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <FormField control={form.control} name="quantity" render={({ field: { value } }) => {
              const uom = lots.find(l => l.id === watchedStockItemId)?.unitOfMeasure
              return (
                <FormItem className="md:col-span-4">
                  <FormLabel>Quantity <span className="text-destructive">*</span>{uom && <span className="ml-1 text-muted-foreground font-normal">({uom})</span>}</FormLabel>
                  <FormControl><Input type="number" step="0.001" min="0" value={value} {...form.register('quantity', { valueAsNumber: true })} /></FormControl>
                  <FormMessage />
                </FormItem>
              )
            }} />

            <div className="md:col-span-8 space-y-2">
            <CurrencyInput
              amountName="rate"
              currencyName="currencyCode"
              exchangeRateName="exchangeRate"
              label="Rate per Unit"
              required
            />
            {belowCost && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Below purchase cost (Rs {Math.round(cost!).toLocaleString()})
              </p>
            )}
            </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem className={locations.length > 0 ? 'md:col-span-4' : 'md:col-span-6'}>
                <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="paymentDueDate" render={({ field }) => (
              <FormItem className={locations.length > 0 ? 'md:col-span-4' : 'md:col-span-6'}>
                <FormLabel>Payment Due Date</FormLabel>
                <FormControl><Input type="date" className="min-h-[44px]" {...field} value={field.value ?? ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {locations.length > 0 && (
              <FormField control={form.control} name="locationId" render={({ field }) => (
                <FormItem className="md:col-span-4">
                  <FormLabel>Location</FormLabel>
                  <Select
                    value={field.value || '_none_'}
                    onValueChange={(v) => field.onChange(v === '_none_' ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="Select location…" /></SelectTrigger>
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
            </div>
              </CardContent>
            </Card>

            {/* ── Summary (right on xl, sticky) ── */}
            <div className="xl:sticky xl:top-6">
              <Card><CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Sale Summary</p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Customer</span>
                    <span className="font-medium text-right">{customerName ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Item</span>
                    <span className="font-medium text-right">{selectedLot?.name ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Quantity</span>
                    <span className="font-medium tabular-nums text-right">{watchedQty.toLocaleString()}{selectedLot?.unitOfMeasure ? ` ${selectedLot.unitOfMeasure}` : ''}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Rate</span>
                    <span className="font-medium tabular-nums text-right">{formatCurrency(rateNum, watchedCurrency)}</span>
                  </div>
                  {watchedCurrency === 'USD' && (
                    <>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Amount (USD)</span>
                        <span className="font-medium tabular-nums text-right">{formatCurrency(lineAmount, watchedCurrency)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Exchange Rate</span>
                        <span className="font-medium tabular-nums text-right">{(Number(watchedER) || 1).toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Date</span>
                    <span className="font-medium tabular-nums">{watchedDate || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Due</span>
                    <span className="font-medium tabular-nums">{watchedDueDate || '—'}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between items-center gap-2 mb-5">
                  <span className="font-bold text-sm">Total</span>
                  <span className="text-lg font-extrabold tabular-nums tracking-tight text-right">{formatPKR(totalPKR)}</span>
                </div>

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                    {isPending ? 'Saving…' : 'Save'}
                  </Button>
                  <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.push('/sales')}>
                    Cancel
                  </Button>
                </div>
                {error && <p className="text-sm text-destructive mt-3">{error}</p>}
              </CardContent></Card>
            </div>
            </div>
          </form>
        </Form>

      {/* Below-cost warning */}
      <Dialog open={!!confirmBelowCost} onOpenChange={(o) => { if (!o) setConfirmBelowCost(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" /> Sale Rate Below Cost
            </DialogTitle>
          </DialogHeader>
          {confirmBelowCost && (() => {
            const c = costMap[confirmBelowCost.stockItemId]
            const ratePKR = confirmBelowCost.rate * (confirmBelowCost.exchangeRate || 1)
            const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 2 })
            return (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2 text-sm">
                <p className="text-muted-foreground">
                  Rate: Rs {fmt(ratePKR)} · Cost: Rs {fmt(c)} · Loss/unit: Rs {fmt(c - ratePKR)}
                </p>
                <p className="mt-1">This sale will make a loss. Save anyway?</p>
              </div>
            )
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBelowCost(null)}>Go Back</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => { const v = confirmBelowCost!; setConfirmBelowCost(null); save(v) }}>
              Confirm Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
