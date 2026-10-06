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
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CurrencyInput } from '@/components/currency-input'
import { editPurchaseReturnAction } from '@/app/actions/edit-purchase-return'
import { YARN_TYPES, normalizeMultiplyBy } from '@/lib/yarn'
import { formatCurrency, formatPKR } from '@/lib/utils/currency'

const schema = z.object({
  supplierId:   z.string().uuid('Select a supplier'),
  stockItemId:  z.string().uuid('Select a stock item'),
  quantity:     z.number().positive('Quantity must be positive'),
  rate:         z.number().positive('Rate must be positive'),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.number().positive().default(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  reason:       z.string().optional(),
  locationId:   z.string().optional(),
  yarnType:     z.string().optional().default(''),
  yarnWeight:   z.preprocess((v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v), z.coerce.number().min(0).optional()),
  multiplyBy:   z.preprocess((v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v), z.coerce.number().positive().optional()),
})

type FormValues = z.infer<typeof schema>

type PurchaseReturn = {
  id: string
  supplierId: string
  stockItemId: string
  quantity: number
  rate: number
  currencyCode: string
  exchangeRate: number
  date: string
  reason: string | null
  locationId: string | null
  yarnType: string | null
  yarnWeight: number | null
  multiplyBy: number | null
}

type Props = {
  ret: PurchaseReturn
  suppliers: { id: string; name: string }[]
  lots: { id: string; name: string; unitOfMeasure: string | null; isYarn?: boolean }[]
  locations: { id: string; name: string }[]
}

const SELECT_CLS = 'flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function EditPurchaseReturnForm({ ret, suppliers, lots, locations }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      supplierId:   ret.supplierId,
      stockItemId:  ret.stockItemId,
      quantity:     ret.quantity,
      rate:         ret.rate,
      currencyCode: ret.currencyCode as 'PKR' | 'USD',
      exchangeRate: ret.exchangeRate,
      date:         ret.date,
      reason:       ret.reason ?? '',
      locationId:   ret.locationId ?? '',
      yarnType:     ret.yarnType ?? '',
      yarnWeight:   ret.yarnWeight ?? NaN,
      multiplyBy:   ret.multiplyBy ?? 1,
    },
  })

  const isYarn = !!lots.find((l) => l.id === form.watch('stockItemId'))?.isYarn

  // Summary values (display only) — mirrors the server's amount formula.
  const watchedPartyId  = form.watch('supplierId')
  const watchedStockId  = form.watch('stockItemId')
  const watchedQty      = Number(form.watch('quantity')) || 0
  const rateNum         = Number(form.watch('rate')) || 0
  const watchedCurrency = form.watch('currencyCode')
  const watchedER       = Number(form.watch('exchangeRate')) || 1
  const watchedDate     = form.watch('date')
  const watchedMultiply = isYarn ? normalizeMultiplyBy(form.watch('multiplyBy')) : 1
  const selectedLot     = lots.find((l) => l.id === watchedStockId)
  const partyName       = suppliers.find((p) => p.id === watchedPartyId)?.name
  const lineAmount      = watchedQty * rateNum * watchedMultiply
  const totalPKR        = lineAmount * (watchedCurrency === 'USD' ? watchedER : 1)

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await editPurchaseReturnAction({ id: ret.id, ...values })
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
      <SheetContent className="overflow-y-auto w-full sm:max-w-5xl">
        <SheetHeader><SheetTitle>Edit Purchase Return</SheetTitle></SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px] gap-5 items-start">
            <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <FormField control={form.control} name="supplierId" render={() => (
              <FormItem className="md:col-span-6">
                <FormLabel>Supplier <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <select {...form.register('supplierId')} className={SELECT_CLS}>
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
                  <select {...form.register('stockItemId')} className={SELECT_CLS}>
                    {lots.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <FormField control={form.control} name="quantity" render={({ field: { value } }) => {
              const uom = lots.find(l => l.id === form.watch('stockItemId'))?.unitOfMeasure
              return (
                <FormItem className="md:col-span-4">
                  <FormLabel>Quantity <span className="text-destructive">*</span>{uom && <span className="ml-1 text-muted-foreground font-normal">({uom})</span>}</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.0001" min="0" value={value}
                      onFocus={(e) => e.target.select()}
                      {...form.register('quantity', { valueAsNumber: true })} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }} />

            <div className="md:col-span-8">
            <CurrencyInput
              amountName="rate"
              currencyName="currencyCode"
              exchangeRateName="exchangeRate"
              label="Rate per Unit"
              step="0.0001"
              required
            />
            </div>
            </div>

            {isYarn && (
              <div className="rounded-md border border-amber-200/70 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 p-3 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Yarn</p>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                <FormItem className="md:col-span-6">
                  <FormLabel>Yarn Type</FormLabel>
                  <select {...form.register('yarnType')} className={SELECT_CLS}>
                    <option value="">Type…</option>
                    {YARN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormItem>
                <div className="grid grid-cols-2 gap-3 md:col-span-6">
                  <FormItem>
                    <FormLabel>Yarn Weight</FormLabel>
                    <Input type="number" step="0.001" min="0" {...form.register('yarnWeight', { valueAsNumber: true })} />
                  </FormItem>
                  <FormItem>
                    <FormLabel>Multiply By</FormLabel>
                    <Input type="number" step="0.0001" min="0" {...form.register('multiplyBy', { valueAsNumber: true })} />
                  </FormItem>
                </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">

            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem className={locations.length > 0 ? 'md:col-span-3' : 'md:col-span-4'}>
                <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="reason" render={({ field }) => (
              <FormItem className={locations.length > 0 ? 'md:col-span-6' : 'md:col-span-8'}>
                <FormLabel>Reason</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Damaged goods, wrong item…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {locations.length > 0 && (
              <FormField control={form.control} name="locationId" render={({ field }) => (
                <FormItem className="md:col-span-3">
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
            </div>
            </div>

            {/* ── Summary — after the fields in source order, shown on the right on wide screens ── */}
            <div className="md:sticky md:top-0">
              <Card><CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Return Summary</p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Supplier</span>
                    <span className="font-medium text-right">{partyName ?? '—'}</span>
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
                  {isYarn && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Multiply By</span>
                      <span className="font-medium tabular-nums text-right">{watchedMultiply.toLocaleString()}</span>
                    </div>
                  )}
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
                    <span className="text-muted-foreground shrink-0">Date</span>
                    <span className="font-medium tabular-nums">{watchedDate || '—'}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between items-center gap-2 mb-5">
                  <span className="font-bold text-sm">Total</span>
                  <span className="text-lg font-extrabold tabular-nums tracking-tight text-right">{formatPKR(totalPKR)}</span>
                </div>

                <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                  {isPending ? 'Saving…' : 'Save'}
                </Button>
                {error && <p className="text-sm text-destructive mt-3">{error}</p>}
              </CardContent></Card>
            </div>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
