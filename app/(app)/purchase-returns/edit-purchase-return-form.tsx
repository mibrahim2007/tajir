'use client'

import { useEffect, useState, useTransition } from 'react'
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
import { editPurchaseReturnAction } from '@/app/actions/edit-purchase-return'
import { YARN_TYPES, normalizeMultiplyBy } from '@/lib/yarn'
import { StockPositionFields } from '@/components/stock-position-fields'
import type { StockPosition } from '@/lib/inventory/stock-position'
import type { GradeOption } from '@/app/actions/grades'
import { usesCartons, needsWeight, cartonStockQty, billingQty, billingUnitLabel, lineGrossAmount, normalizeFormula, ITEM_FORMULAS } from '@/lib/item-formula'
import { STANDARD_PROFILE, profileAt, type ItemProfile } from '@/lib/inventory/item-profiles'
import { RateBasisSelect } from '@/components/rate-basis-select'
import { formatCurrency, formatPKR } from '@/lib/utils/currency'
import { todayPKT } from '@/lib/utils/dates'

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
  // Carton-formula fields (per lb / per kg / per pack): they derive the quantity.
  nosCarton:       z.preprocess((v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v), z.coerce.number().min(0).optional()),
  weightPerCarton: z.preprocess((v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v), z.coerce.number().min(0).optional()),
  // Grade / lot, used only when the item type tracks them.
  gradeId:      z.string().nullable().optional(),
  lotNo:        z.string().nullable().optional(),
  // How the line is measured and billed (0074).
  rateBasis:    z.enum(ITEM_FORMULAS).default('standard'),
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
  nosCarton: number | null
  weightPerCarton: number | null
  gradeId: string | null
  lotNo: string | null
  rateBasis: string | null
  /** Booked against an invoice line: grade / lot come from that line. */
  linked: boolean
}

type Props = {
  ret: PurchaseReturn
  suppliers: { id: string; name: string }[]
  lots: { id: string; name: string; unitOfMeasure: string | null; profile?: ItemProfile }[]
  locations: { id: string; name: string }[]
  grades?: GradeOption[]
  /** On-hand stock per item × location × grade × lot. */
  positions?: StockPosition[]
}

const SELECT_CLS = 'flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

// Full-page form at /purchase-returns/[id]/edit (was a row drawer on the purchase returns list).
export function EditPurchaseReturnForm({ ret, suppliers, lots, locations, grades: initialGrades = [], positions = [] }: Props) {
  const router = useRouter()
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
      nosCarton:       ret.nosCarton ?? NaN,
      weightPerCarton: ret.weightPerCarton ?? NaN,
      gradeId:      ret.gradeId,
      lotNo:        ret.lotNo,
      rateBasis:    normalizeFormula(ret.rateBasis),
    },
  })

  const grades = initialGrades
  // The item type's formula decides the carton fields and the billed quantity.
  // The line's own rate basis decides the carton fields, billed quantity and
  // grade / lot rules (0074); the item only supplies units and defaults.
  const itemProfileOf = (id?: string) => lots.find((l) => l.id === id)?.profile ?? STANDARD_PROFILE
  const profile = profileAt(itemProfileOf(form.watch('stockItemId')), normalizeFormula(form.watch('rateBasis')))
  const isYarn = profile.formula === 'yarn'
  const isCarton = usesCartons(profile.formula)
  const watchedNos = form.watch('nosCarton')
  const watchedWt  = form.watch('weightPerCarton')
  const billedUnit = billingUnitLabel(profile.formula, profile.packUnit)
  const tracksStock = profile.trackGrade || profile.trackLot
  // An item switched to a carton type picks up its standard weight per pack.
  useEffect(() => {
    if (!isCarton || !profile.stdPackWeight) return
    if (Number.isFinite(Number(form.getValues('weightPerCarton')))) return
    form.setValue('weightPerCarton', profile.stdPackWeight, { shouldDirty: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch('stockItemId'), form.watch('rateBasis')])
  // For a carton item, Quantity is derived (Nos Carton × Weight; per pack: packs).
  useEffect(() => {
    const q = cartonStockQty(profile.formula, { nosCarton: watchedNos, weightPerCarton: watchedWt })
    if (q === null) return
    const cur = Number(form.getValues('quantity'))
    const next = q > 0 ? q : NaN
    const same = q > 0 ? cur === q : Number.isNaN(cur)
    if (!same) form.setValue('quantity', next, { shouldDirty: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.formula, watchedNos, watchedWt])

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
  const billedQty       = billingQty(profile.formula, { quantity: watchedQty, nosCarton: watchedNos, weightPerCarton: watchedWt })
  const lineAmount      = lineGrossAmount(profile.formula, { quantity: watchedQty, nosCarton: watchedNos, weightPerCarton: watchedWt, multiplyBy: watchedMultiply }, rateNum)
  const gradeName       = grades.find((g) => g.id === form.watch('gradeId'))?.name
  const totalPKR        = lineAmount * (watchedCurrency === 'USD' ? watchedER : 1)

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await editPurchaseReturnAction({
        id: ret.id,
        ...values,
        nosCarton:       Number.isFinite(values.nosCarton) ? values.nosCarton : undefined,
        weightPerCarton: Number.isFinite(values.weightPerCarton) ? values.weightPerCarton : undefined,
        gradeId:         values.gradeId || undefined,
        lotNo:           values.lotNo?.trim() || undefined,
        rateBasis:       values.rateBasis,
      })
      if (!result.success) { setError(result.error); return }
      // Back to the list, which re-renders with the change. No
      // router.refresh() inside the transition — it keeps isPending stuck.
      router.push('/purchase-returns')
    })
  }

  return (
    <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
            <Card className="min-w-0">
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-base">Return Details</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 flex flex-col gap-4">
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
                  <select
                    {...form.register('stockItemId', {
                      // A different item starts on the basis last used for it.
                      onChange: (e) => form.setValue('rateBasis', itemProfileOf(e.target.value).formula, { shouldDirty: true }),
                    })}
                    className={SELECT_CLS}
                  >
                    {lots.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <FormItem className="md:col-span-3">
              <FormLabel>Rate Basis</FormLabel>
              <RateBasisSelect
                className="min-h-[44px] w-full"
                value={form.watch('rateBasis')}
                onChange={(b) => form.setValue('rateBasis', b, { shouldDirty: true })}
              />
            </FormItem>
            {isCarton && (
              <>
                <FormItem className="md:col-span-3">
                  <FormLabel>Nos Carton</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.0001" min="0" className="text-right"
                      {...form.register('nosCarton', { valueAsNumber: true })} />
                  </FormControl>
                </FormItem>
                <FormItem className="md:col-span-3">
                  <FormLabel>Weight (kg){!needsWeight(profile.formula) && <span className="ml-1 text-muted-foreground font-normal">(optional)</span>}</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.0001" min="0" className="text-right"
                      {...form.register('weightPerCarton', { valueAsNumber: true })} />
                  </FormControl>
                </FormItem>
              </>
            )}

            <FormField control={form.control} name="quantity" render={({ field: { value } }) => {
              const uom = lots.find(l => l.id === form.watch('stockItemId'))?.unitOfMeasure
              return (
                <FormItem className={isCarton ? 'md:col-span-3' : 'md:col-span-4'}>
                  <FormLabel>Quantity <span className="text-destructive">*</span>{uom && <span className="ml-1 text-muted-foreground font-normal">({uom})</span>}{isCarton && <span className="ml-1 text-muted-foreground font-normal">(auto)</span>}</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.0001" min="0" value={value}
                      readOnly={isCarton} tabIndex={isCarton ? -1 : undefined}
                      className={isCarton ? 'bg-muted/40 text-muted-foreground cursor-default' : undefined}
                      onFocus={(e) => e.target.select()}
                      {...form.register('quantity', { valueAsNumber: true })} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }} />

            {isCarton && (
              <FormItem className="md:col-span-3">
                <FormLabel>Billed Qty ({billedUnit})</FormLabel>
                <div className="flex h-11 items-center justify-end rounded-md border border-input bg-muted/40 px-3 text-sm tabular-nums text-muted-foreground">
                  {billedQty > 0 ? billedQty.toLocaleString('en-PK', { maximumFractionDigits: 4 }) : '—'}
                </div>
              </FormItem>
            )}

            <div className={isCarton ? 'md:col-span-12' : 'md:col-span-8'}>
            <CurrencyInput
              amountName="rate"
              currencyName="currencyCode"
              exchangeRateName="exchangeRate"
              label={isCarton ? `Rate per ${billedUnit}` : 'Rate per Unit'}
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

            {tracksStock && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Grade / Lot</p>
                {ret.linked ? (
                  <p className="text-sm text-muted-foreground">
                    From the purchase line: {[
                      profile.trackGrade ? `Grade ${gradeName ?? '—'}` : null,
                      profile.trackLot ? `Lot ${ret.lotNo ?? '—'}` : null,
                    ].filter(Boolean).join(' · ')}
                  </p>
                ) : (
                  <StockPositionFields
                    className="min-h-[44px] w-full"
                    positions={positions}
                    stockItemId={form.watch('stockItemId')}
                    locationId={form.watch('locationId') || null}
                    grades={grades}
                    trackGrade={profile.trackGrade}
                    trackLot={profile.trackLot}
                    gradeId={form.watch('gradeId')}
                    lotNo={form.watch('lotNo')}
                    stockUnit={profile.stockUnit}
                    packUnit={profile.packUnit}
                    onChange={(next) => {
                      form.setValue('gradeId', next.gradeId, { shouldDirty: true })
                      form.setValue('lotNo', next.lotNo, { shouldDirty: true })
                    }}
                  />
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">

            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem className={locations.length > 0 ? 'md:col-span-3' : 'md:col-span-4'}>
                <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="date" max={todayPKT()} className="min-h-[44px]" {...field} /></FormControl>
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
                  {isCarton && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Billed Qty</span>
                      <span className="font-medium tabular-nums text-right">{billedQty > 0 ? `${billedQty.toLocaleString('en-PK', { maximumFractionDigits: 4 })} ${billedUnit}` : '—'}</span>
                    </div>
                  )}
                  {profile.trackGrade && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Grade</span>
                      <span className="font-medium text-right">{gradeName ?? '—'}</span>
                    </div>
                  )}
                  {profile.trackLot && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Lot</span>
                      <span className="font-medium text-right">{form.watch('lotNo') || '—'}</span>
                    </div>
                  )}
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

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                    {isPending ? 'Saving…' : 'Save'}
                  </Button>
                  <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.push('/purchase-returns')}>
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
