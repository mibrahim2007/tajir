'use client'

import React, { useRef, useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ExitButton } from '@/components/exit-button'
import { useForm, useFieldArray, type Resolver, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { NumericInput } from '@/components/numeric-input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ItemPickerDialog, type PickerItem } from '@/components/item-picker-dialog'
import { buildPartyItems, needsMirror } from '@/lib/party-picker'
import { resolvePartyAction } from '@/app/actions/resolve-party'
import { QuickCreateSupplier, QuickCreateLot } from '@/components/quick-create-forms'
import { createPurchaseInvoiceAction } from '@/app/actions/create-purchase-invoice'
import { FileUploader, type FileUploaderHandle } from '@/components/file-uploader'
import { YarnLineFields } from '@/components/yarn-line-fields'
import { computeQtyLbs } from '@/lib/polyester'

const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
  z.coerce.number().min(0).optional(),
)

const lineSchema = z.object({
  stockItemId:  z.string().uuid('Select a stock item'),
  quantity:     z.number().positive('Enter quantity'),
  rate:         z.number().positive('Enter rate'),
  discountPct:  z.number().min(0).max(100).default(0),
  yarnType:     z.string().optional().default(''),
  yarnWeight:   z.preprocess((v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v), z.coerce.number().min(0).optional()),
  multiplyBy:   z.preprocess((v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v), z.coerce.number().positive().optional()),
  // Polyester-only line fields (cartons + weight per carton in kg). QTY LBS is
  // derived and drives the amount; stock still uses `quantity`.
  nosCarton:        optionalNumber,
  weightPerCarton:  optionalNumber,
})

const schema = z.object({
  supplierId:   z.string().min(1, 'Supplier is required'),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  notes:        z.string().optional(),
  advancePaid:  z.number().min(0).default(0),
  currencyCode: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.number().positive().default(1),
  locationId:   z.string().min(1, 'Location is required'),
  lines:        z.array(lineSchema).min(1, 'Add at least one item'),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD', path: ['exchangeRate'] },
)

type FormValues = z.infer<typeof schema>

type Props = {
  today: string
  suppliers: { id: string; name: string }[]
  customers?: { id: string; name: string }[]
  lots:      { id: string; name: string; count: string; unitOfMeasure: string | null; isYarn?: boolean; isPolyester?: boolean }[]
  locations: { id: string; name: string }[]
}

export function CreatePurchaseForm({ today, suppliers, customers = [], lots, locations }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const uploaderRef = useRef<FileUploaderHandle>(null)

  // Local state so newly created items appear immediately without page refresh
  const [supplierList, setSupplierList] = useState<PickerItem[]>(
    suppliers.map((s) => ({ id: s.id, name: s.name }))
  )
  const [lotList, setLotList] = useState<PickerItem[]>(
    lots.map((l) => ({ id: l.id, name: l.name, badge: l.count }))
  )

  // Merged party list: customers + suppliers, each with an identity badge. Both
  // are selectable; a customer pick is mirrored to a supplier at save time.
  const supplierPickerItems = useMemo(
    () => buildPartyItems(customers, supplierList),
    [customers, supplierList],
  )
  const lotPickerItems      = lotList
  const yarnLotIds = useMemo(() => new Set(lots.filter((l) => l.isYarn).map((l) => l.id)), [lots])
  const polyesterLotIds = useMemo(() => new Set(lots.filter((l) => l.isPolyester).map((l) => l.id)), [lots])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      supplierId: '', date: today, notes: '', advancePaid: 0,
      currencyCode: 'PKR', exchangeRate: 1, locationId: '',
      lines: [{ stockItemId: '', quantity: NaN, rate: NaN, discountPct: 0, yarnType: '', yarnWeight: NaN, multiplyBy: 1, nosCarton: NaN, weightPerCarton: NaN }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })

  const watchedCurrency     = form.watch('currencyCode')
  const watchedExchangeRate = form.watch('exchangeRate')
  const watchedLines        = form.watch('lines')

  const er = watchedCurrency === 'USD' ? (watchedExchangeRate || 1) : 1

  // Yarn lines multiply the money amount by their Multiply By (default 1).
  const lineMult = (l: { stockItemId?: string; multiplyBy?: number | null }) =>
    l.stockItemId && yarnLotIds.has(l.stockItemId) ? (Number(l.multiplyBy) || 1) : 1

  // Pre-discount amount for a line. Polyester lines bill on QTY LBS
  // (nos_carton * weight / 2.2046) instead of the plain quantity; every other
  // line keeps quantity * rate * yarn-multiplier.
  const lineGross = (l: {
    stockItemId?: string; quantity?: number | null; rate?: number | null
    multiplyBy?: number | null; nosCarton?: number | null; weightPerCarton?: number | null
  }) => {
    const rate = (l.rate || 0) * er
    if (l.stockItemId && polyesterLotIds.has(l.stockItemId)) {
      return computeQtyLbs(l.nosCarton, l.weightPerCarton) * rate
    }
    return (l.quantity || 0) * rate * lineMult(l)
  }

  const { subtotal, discountTotal, netTotal } = useMemo(() => {
    const sub  = watchedLines.reduce((s, l) => s + lineGross(l), 0)
    const disc = watchedLines.reduce((s, l) => s + lineGross(l) * ((l.discountPct || 0) / 100), 0)
    return { subtotal: sub, discountTotal: disc, netTotal: sub - disc }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedLines, er, yarnLotIds, polyesterLotIds])

  // Show the Nos_Carton / Wt/Carton / QTY LBS columns only when the invoice has
  // at least one polyester line, so ordinary invoices stay unchanged.
  const hasPolyester = watchedLines.some((l) => !!l.stockItemId && polyesterLotIds.has(l.stockItemId))

  const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 0 })
  const fmt4 = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 4 })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)

      // If a customer was picked, mirror it to a supplier so supplier_id is valid.
      let supplierId = values.supplierId
      if (needsMirror(supplierId, supplierList.map((s) => s.id))) {
        const res = await resolvePartyAction({ partyId: supplierId, requiredType: 'supplier' })
        if (!res.success) { setServerError(res.error); return }
        supplierId = res.data.id
      }

      const result = await createPurchaseInvoiceAction({
        supplierId,
        date:         values.date,
        currencyCode: values.currencyCode,
        exchangeRate: values.exchangeRate,
        advancePaid:  values.advancePaid,
        locationId:   values.locationId,
        notes:        values.notes,
        lines: values.lines.map((l) => ({
          stockItemId: l.stockItemId,
          quantity:    l.quantity,
          rate:        l.rate,
          discountPct: l.discountPct,
          yarnType:    l.yarnType || undefined,
          yarnWeight:  Number.isFinite(l.yarnWeight) ? l.yarnWeight : undefined,
          multiplyBy:  Number.isFinite(l.multiplyBy) ? l.multiplyBy : undefined,
          nosCarton:       Number.isFinite(l.nosCarton) ? l.nosCarton : undefined,
          weightPerCarton: Number.isFinite(l.weightPerCarton) ? l.weightPerCarton : undefined,
        })),
      })
      if (!result.success) { setServerError(result.error); return }
      await uploaderRef.current?.uploadFiles(result.data.invoiceId, 'purchase_order')
      router.push('/purchases')
    })
  }

  const canSubmit = !isPending && supplierList.length > 0 && lotList.length > 0

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-5">

            {/* Header card */}
            <Card>
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-base">Purchase Details</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 grid gap-4 sm:grid-cols-2">

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
                        createLabel="New Supplier"
                        onCreateSuccess={(item) => setSupplierList((prev) => [...prev, item])}
                        quickCreate={(onSuccess, onCancel) => (
                          <QuickCreateSupplier onSuccess={onSuccess} onCancel={onCancel} />
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="locationId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receive At <span className="text-destructive">*</span></FormLabel>
                    <Select
                      value={field.value || ''}
                      onValueChange={field.onChange}
                      disabled={locations.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue placeholder={locations.length === 0 ? 'No locations defined' : 'Select location…'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {locations.length === 0 && (
                      <p className="text-xs text-muted-foreground">Add locations in Settings → Locations</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="flex gap-2 items-end">
                  <FormField control={form.control} name="currencyCode" render={({ field }) => (
                    <FormItem className="w-28">
                      <FormLabel>Currency</FormLabel>
                      <Select value={field.value} onValueChange={(v) => { field.onChange(v); if (v === 'PKR') form.setValue('exchangeRate', 1) }}>
                        <FormControl>
                          <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PKR">PKR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  {watchedCurrency === 'USD' && (
                    <FormField control={form.control} name="exchangeRate" render={() => (
                      <FormItem className="flex-1">
                        <FormLabel>Rate (1 USD = ? PKR) <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="1" placeholder="e.g. 278.50"
                            {...form.register('exchangeRate', { valueAsNumber: true })} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>

              </CardContent>
            </Card>

            {/* Line items card */}
            <Card>
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-base">Line Items</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-8">#</th>
                          <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Item</th>
                          {hasPolyester && <>
                            <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-28">Nos Carton</th>
                            <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-28">Weight</th>
                          </>}
                          <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-40">{hasPolyester ? 'Quantity' : 'Qty'}</th>
                          {hasPolyester && (
                            <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-32">LBS Qty</th>
                          )}
                          <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-36">Rate</th>
                          <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-20">Disc %</th>
                          <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-32">Amount</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {fields.map((field, index) => {
                          const line = watchedLines[index] ?? {}
                          const isYarnLine = !!line.stockItemId && yarnLotIds.has(line.stockItemId)
                          const isPolyesterLine = !!line.stockItemId && polyesterLotIds.has(line.stockItemId)
                          const qtyLbs = computeQtyLbs(line.nosCarton, line.weightPerCarton)
                          const gross  = lineGross(line)
                          const amount = gross * (1 - (line.discountPct || 0) / 100)
                          return (
                            <React.Fragment key={field.id}>
                            <tr className="align-top">
                              <td className="px-3 py-3 text-muted-foreground text-xs">{index + 1}</td>
                              <td className="px-3 py-2 min-w-[180px]">
                                <Controller
                                  control={form.control}
                                  name={`lines.${index}.stockItemId`}
                                  render={({ field: f, fieldState }) => (
                                    <div>
                                      <ItemPickerDialog
                                        items={lotPickerItems}
                                        value={f.value}
                                        onSelect={f.onChange}
                                        placeholder="Select item…"
                                        title="Select Stock Item"
                                        createLabel="New Stock Item"
                                        onCreateSuccess={(item) => setLotList((prev) => [...prev, item])}
                                        quickCreate={(onSuccess, onCancel) => (
                                          <QuickCreateLot onSuccess={onSuccess} onCancel={onCancel} />
                                        )}
                                      />
                                      {fieldState.error && <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>}
                                    </div>
                                  )}
                                />
                              </td>
                              {hasPolyester && (isPolyesterLine ? <>
                                <td className="px-3 py-2">
                                  <NumericInput min={0} step="0.0001" placeholder="" className="text-right"
                                    {...form.register(`lines.${index}.nosCarton`, { valueAsNumber: true })} />
                                </td>
                                <td className="px-3 py-2">
                                  <NumericInput min={0} step="0.0001" placeholder="" className="text-right"
                                    {...form.register(`lines.${index}.weightPerCarton`, { valueAsNumber: true })} />
                                </td>
                              </> : <>
                                <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                                <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                              </>)}
                              <td className="px-3 py-2">
                                <NumericInput min={0} step="0.0001" placeholder="" className="text-right"
                                  {...form.register(`lines.${index}.quantity`, { valueAsNumber: true })} />
                                {form.formState.errors.lines?.[index]?.quantity && (
                                  <p className="text-xs text-destructive mt-1">{form.formState.errors.lines[index]?.quantity?.message}</p>
                                )}
                                {(() => { const uom = lots.find(l => l.id === line.stockItemId)?.unitOfMeasure; return uom ? <p className="text-xs text-muted-foreground mt-0.5 text-right">{uom}</p> : null })()}
                              </td>
                              {hasPolyester && (isPolyesterLine
                                ? <td className="px-3 py-2 text-right tabular-nums pt-3 text-muted-foreground">{qtyLbs > 0 ? fmt4(qtyLbs) : '—'}</td>
                                : <td className="px-3 py-2 text-right text-muted-foreground">—</td>)}
                              <td className="px-3 py-2">
                                <NumericInput min={0} step="0.0001" placeholder="" className="text-right"
                                  {...form.register(`lines.${index}.rate`, { valueAsNumber: true })} />
                                {form.formState.errors.lines?.[index]?.rate && (
                                  <p className="text-xs text-destructive mt-1">{form.formState.errors.lines[index]?.rate?.message}</p>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <NumericInput min={0} max={100} step="0.1" placeholder="0" className="text-right"
                                  {...form.register(`lines.${index}.discountPct`, { valueAsNumber: true })} />
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums pt-3 font-medium">
                                {amount > 0 ? `Rs ${fmt(amount)}` : '—'}
                              </td>
                              <td className="px-1 py-2 pt-2">
                                <Button type="button" variant="ghost" size="icon-sm"
                                  onClick={() => remove(index)} disabled={fields.length === 1}
                                  className="text-muted-foreground hover:text-destructive">
                                  <Trash2 className="size-4" />
                                </Button>
                              </td>
                            </tr>
                            {isYarnLine && (
                              <tr>
                                <td />
                                <td colSpan={hasPolyester ? 9 : 6} className="px-3 pb-3">
                                  <YarnLineFields index={index} />
                                </td>
                              </tr>
                            )}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-3">
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => append({ stockItemId: '', quantity: 0, rate: 0, discountPct: 0, yarnType: '', yarnWeight: NaN, multiplyBy: 1, nosCarton: NaN, weightPerCarton: NaN })}
                    className="gap-1.5">
                    <Plus className="size-4" /> Add Line
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Notes card */}
            <Card>
              <CardContent className="px-5 py-4">
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Delivery instructions, terms, or any remarks…" rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

          </div>

          {/* ── RIGHT COLUMN — sticky summary ── */}
          <div className="lg:sticky lg:top-6 space-y-4">
            <Card>
              <CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Purchase Summary</p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items ({fields.length})</span>
                    <span className="tabular-nums font-medium">Rs {fmt(subtotal)}</span>
                  </div>
                  {discountTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="tabular-nums font-medium text-rose-600">− Rs {fmt(discountTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Net Amount</span>
                    <span className="tabular-nums font-medium">Rs {fmt(netTotal)}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between items-center mb-5">
                  <span className="font-bold text-sm">Total</span>
                  <span className="text-xl font-extrabold tabular-nums tracking-tight">Rs {fmt(netTotal)}</span>
                </div>

                {/* Advance Paid */}
                <FormField control={form.control} name="advancePaid" render={() => (
                  <FormItem className="mb-4">
                    <FormLabel>Advance Paid (PKR)</FormLabel>
                    <FormControl>
                      <NumericInput step="0.01" min="0" placeholder="0"
                        {...form.register('advancePaid', { valueAsNumber: true })} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px] bg-green-600 hover:bg-green-700 text-white"
                    disabled={!canSubmit}>
                    {isPending ? 'Saving…' : `Confirm Purchase${fields.length > 1 ? ` (${fields.length} items)` : ''}`}
                  </Button>
                  <ExitButton
                    isDirty={form.formState.isDirty}
                    onExit={() => router.back()}
                    className="w-full min-h-[44px]"
                  />
                </div>

                {serverError && <p className="text-sm text-destructive mt-3">{serverError}</p>}
                {(supplierList.length === 0 || lotList.length === 0) && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    {supplierList.length === 0 ? 'Add a supplier first.' : 'Add a stock item first.'}
                  </p>
                )}

                <div className="mt-4 pt-4 border-t">
                  <FileUploader ref={uploaderRef} />
                </div>

              </CardContent>
            </Card>
          </div>

        </div>
      </form>
    </Form>
  )
}
