'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CurrencyInput } from '@/components/currency-input'
import { NumericInput } from '@/components/numeric-input'
import { computeQtyLbs } from '@/lib/polyester'
import { editPurchaseAction } from '@/app/actions/edit-purchase'
import { formatCurrency, formatPKR } from '@/lib/utils/currency'
import { todayPKT } from '@/lib/utils/dates'

const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
  z.coerce.number().min(0).optional(),
)

const schema = z.object({
  supplierId:   z.string().min(1, 'Supplier is required'),
  stockItemId:  z.string().min(1, 'Stock item is required'),
  quantity:     z.number().positive('Quantity must be positive'),
  rate:         z.number().positive('Rate must be positive'),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.number().positive().default(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  advancePaid:  z.number().min(0).default(0),
  locationId:   z.string().optional(),
  nosCarton:        optionalNumber,
  weightPerCarton:  optionalNumber,
})

type FormValues = z.infer<typeof schema>

type Purchase = {
  id: string
  supplierId: string
  stockItemId: string
  quantity: number
  rate: number
  currencyCode: string
  exchangeRate: number
  advancePaid: number
  date: string
  locationId: string | null
  nosCarton?: number | null
  weightPerCarton?: number | null
}

type Props = {
  purchase: Purchase
  suppliers: { id: string; name: string }[]
  lots: { id: string; name: string; count: string; unitOfMeasure: string | null; isPolyester?: boolean }[]
  locations: { id: string; name: string }[]
}

// Full-page form at /purchases/[id]/edit (was a row drawer on the purchases list).
export function EditPurchaseForm({ purchase, suppliers, lots, locations }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      supplierId:   purchase.supplierId,
      stockItemId:  purchase.stockItemId,
      quantity:     purchase.quantity,
      rate:         purchase.rate,
      currencyCode: purchase.currencyCode as 'PKR' | 'USD',
      exchangeRate: purchase.exchangeRate,
      date:         purchase.date,
      advancePaid:  purchase.advancePaid,
      locationId:   purchase.locationId ?? '',
      nosCarton:        purchase.nosCarton ?? undefined,
      weightPerCarton:  purchase.weightPerCarton ?? undefined,
    },
  })

  const selectedIsPolyester = !!lots.find((l) => l.id === form.watch('stockItemId'))?.isPolyester
  const watchedNos = form.watch('nosCarton')
  const watchedWt  = form.watch('weightPerCarton')
  const qtyLbs = computeQtyLbs(watchedNos, watchedWt)

  // Summary values (display only) — polyester lines are priced per lb.
  const watchedSupplierId = form.watch('supplierId')
  const watchedStockId    = form.watch('stockItemId')
  const watchedQty        = Number(form.watch('quantity')) || 0
  const rateNum           = Number(form.watch('rate')) || 0
  const watchedCurrency   = form.watch('currencyCode')
  const watchedER         = Number(form.watch('exchangeRate')) || 1
  const watchedAdvance    = Number(form.watch('advancePaid')) || 0
  const watchedDate       = form.watch('date')
  const selectedLot       = lots.find((l) => l.id === watchedStockId)
  const supplierName      = suppliers.find((s) => s.id === watchedSupplierId)?.name
  const pricedQty         = selectedIsPolyester ? qtyLbs : watchedQty
  const lineAmount        = pricedQty * rateNum
  const totalPKR          = lineAmount * (watchedCurrency === 'USD' ? watchedER : 1)

  // For a polyester item, Quantity is derived = Nos Carton × Weight.
  useEffect(() => {
    if (!selectedIsPolyester) return
    const q = (Number(watchedNos) || 0) * (Number(watchedWt) || 0)
    const cur = Number(form.getValues('quantity'))
    const next = q > 0 ? q : NaN
    const same = q > 0 ? cur === q : Number.isNaN(cur)
    if (!same) form.setValue('quantity', next, { shouldDirty: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIsPolyester, watchedNos, watchedWt])

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await editPurchaseAction({ id: purchase.id, ...values })
      if (!result.success) { setError(result.error); return }
      // Back to the list, which re-renders with the change. No
      // router.refresh() inside the transition — it keeps isPending stuck.
      router.push('/purchases')
    })
  }

  return (
    <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
            <Card className="min-w-0">
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-base">Purchase Details</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <FormField control={form.control} name="supplierId" render={() => (
              <FormItem className="md:col-span-6">
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
              <FormItem className="md:col-span-6">
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            {selectedIsPolyester && (
              <>
                <FormItem className="md:col-span-3">
                  <FormLabel>Nos Carton</FormLabel>
                  <FormControl>
                    <NumericInput step="0.0001" min="0" className="text-right"
                      {...form.register('nosCarton', { valueAsNumber: true })} />
                  </FormControl>
                </FormItem>
                <FormItem className="md:col-span-3">
                  <FormLabel>Weight</FormLabel>
                  <FormControl>
                    <NumericInput step="0.0001" min="0" className="text-right"
                      {...form.register('weightPerCarton', { valueAsNumber: true })} />
                  </FormControl>
                </FormItem>
              </>
            )}

            <FormField control={form.control} name="quantity" render={({ field: { value } }) => {
              const uom = lots.find(l => l.id === form.watch('stockItemId'))?.unitOfMeasure
              return (
                <FormItem className={selectedIsPolyester ? 'md:col-span-3' : 'md:col-span-4'}>
                  <FormLabel>Quantity <span className="text-destructive">*</span>{uom && <span className="ml-1 text-muted-foreground font-normal">({uom})</span>}{selectedIsPolyester && <span className="ml-1 text-muted-foreground font-normal">(auto = Nos Carton × Weight)</span>}</FormLabel>
                  <FormControl><Input type="number" step="0.001" min="0" value={value} readOnly={selectedIsPolyester} tabIndex={selectedIsPolyester ? -1 : undefined} className={selectedIsPolyester ? 'bg-muted/40 text-muted-foreground cursor-default' : undefined} {...form.register('quantity', { valueAsNumber: true })} /></FormControl>
                  <FormMessage />
                </FormItem>
              )
            }} />

            {selectedIsPolyester && (
              <FormItem className="md:col-span-3">
                <FormLabel>LBS Qty</FormLabel>
                <div className="flex h-11 items-center justify-end rounded-md border border-input bg-muted/40 px-3 text-sm tabular-nums text-muted-foreground">
                  {qtyLbs > 0 ? qtyLbs.toLocaleString('en-PK', { maximumFractionDigits: 4 }) : '—'}
                </div>
              </FormItem>
            )}

            <div className={selectedIsPolyester ? 'md:col-span-12' : 'md:col-span-8'}>
            <CurrencyInput
              amountName="rate"
              currencyName="currencyCode"
              exchangeRateName="exchangeRate"
              label={selectedIsPolyester ? 'Rate per Lb' : 'Rate per Unit'}
              required
            />
            </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <FormField control={form.control} name="advancePaid" render={() => (
              <FormItem className={locations.length > 0 ? 'md:col-span-4' : 'md:col-span-6'}>
                <FormLabel>Advance Paid (PKR)</FormLabel>
                <FormControl><Input type="number" step="0.01" min="0" {...form.register('advancePaid', { valueAsNumber: true })} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem className={locations.length > 0 ? 'md:col-span-4' : 'md:col-span-6'}>
                <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="date" max={todayPKT()} className="min-h-[44px]" {...field} /></FormControl>
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
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Purchase Summary</p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Supplier</span>
                    <span className="font-medium text-right">{supplierName ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Item</span>
                    <span className="font-medium text-right">{selectedLot?.name ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Quantity</span>
                    <span className="font-medium tabular-nums text-right">{watchedQty.toLocaleString()}{selectedLot?.unitOfMeasure ? ` ${selectedLot.unitOfMeasure}` : ''}</span>
                  </div>
                  {selectedIsPolyester && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">LBS Qty</span>
                      <span className="font-medium tabular-nums text-right">{qtyLbs > 0 ? qtyLbs.toLocaleString('en-PK', { maximumFractionDigits: 4 }) : '—'}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">{selectedIsPolyester ? 'Rate / Lb' : 'Rate'}</span>
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
                        <span className="font-medium tabular-nums text-right">{watchedER.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Advance Paid</span>
                    <span className="font-medium tabular-nums text-right">{formatPKR(watchedAdvance)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Date</span>
                    <span className="font-medium tabular-nums">{watchedDate || '—'}</span>
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
                  <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.push('/purchases')}>
                    Cancel
                  </Button>
                </div>
                {error && <p className="text-sm text-destructive mt-3">{error}</p>}
              </CardContent></Card>
            </div>
            </div>
          </form>
    </Form>
  )
}
