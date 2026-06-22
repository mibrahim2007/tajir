'use client'

import { useRef, useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, type Resolver, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ItemPickerDialog, type PickerItem } from '@/components/item-picker-dialog'
import { QuickCreateSupplier, QuickCreateLot } from '@/components/quick-create-forms'
import { createPurchaseAction } from '@/app/actions/create-purchase'
import { FileUploader, type FileUploaderHandle } from '@/components/file-uploader'

const lineSchema = z.object({
  stockItemId:  z.string().uuid('Select a stock item'),
  quantity:     z.number().positive('Enter quantity'),
  rate:         z.number().positive('Enter rate'),
  discountPct:  z.number().min(0).max(100).default(0),
})

const schema = z.object({
  supplierId:   z.string().min(1, 'Supplier is required'),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  notes:        z.string().optional(),
  advancePaid:  z.number().min(0).default(0),
  currencyCode: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.number().positive().default(1),
  locationId:   z.string().optional(),
  lines:        z.array(lineSchema).min(1, 'Add at least one item'),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD', path: ['exchangeRate'] },
)

type FormValues = z.infer<typeof schema>

type Props = {
  today: string
  suppliers: { id: string; name: string }[]
  lots:      { id: string; name: string; count: string }[]
  locations: { id: string; name: string }[]
}

export function CreatePurchaseForm({ today, suppliers, lots, locations }: Props) {
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

  const supplierPickerItems = supplierList
  const lotPickerItems      = lotList

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      supplierId: '', date: today, notes: '', advancePaid: 0,
      currencyCode: 'PKR', exchangeRate: 1, locationId: '',
      lines: [{ stockItemId: '', quantity: 0, rate: 0, discountPct: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })

  const watchedCurrency     = form.watch('currencyCode')
  const watchedExchangeRate = form.watch('exchangeRate')
  const watchedLines        = form.watch('lines')

  const er = watchedCurrency === 'USD' ? (watchedExchangeRate || 1) : 1

  const { subtotal, discountTotal, netTotal } = useMemo(() => {
    const sub  = watchedLines.reduce((s, l) => s + (l.quantity || 0) * (l.rate || 0) * er, 0)
    const disc = watchedLines.reduce((s, l) => s + (l.quantity || 0) * (l.rate || 0) * er * ((l.discountPct || 0) / 100), 0)
    return { subtotal: sub, discountTotal: disc, netTotal: sub - disc }
  }, [watchedLines, er])

  const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 0 })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      let firstEntryId: string | null = null
      for (let i = 0; i < values.lines.length; i++) {
        const line = values.lines[i]
        // bake discount into the saved rate
        const effectiveRate = line.rate * (1 - (line.discountPct || 0) / 100)
        const result = await createPurchaseAction({
          supplierId:   values.supplierId,
          stockItemId:  line.stockItemId,
          quantity:     line.quantity,
          rate:         effectiveRate,
          currencyCode: values.currencyCode,
          exchangeRate: values.exchangeRate,
          date:         values.date,
          advancePaid:  i === 0 ? values.advancePaid : 0,
          locationId:   values.locationId || undefined,
        })
        if (!result.success) { setServerError(`Line ${i + 1}: ${result.error}`); return }
        if (i === 0) firstEntryId = result.data.id
      }
      if (firstEntryId) await uploaderRef.current?.uploadFiles(firstEntryId, 'purchase_order')
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

                {locations.length > 0 && (
                  <FormField control={form.control} name="locationId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receive At</FormLabel>
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
                          <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-24">Qty</th>
                          <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-28">Rate</th>
                          <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-20">Disc %</th>
                          <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-32">Amount</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {fields.map((field, index) => {
                          const line = watchedLines[index] ?? {}
                          const gross  = (line.quantity || 0) * (line.rate || 0) * er
                          const amount = gross * (1 - (line.discountPct || 0) / 100)
                          return (
                            <tr key={field.id} className="align-top">
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
                              <td className="px-3 py-2">
                                <Input type="number" min={0} step="0.001" placeholder="0" className="text-right"
                                  {...form.register(`lines.${index}.quantity`, { valueAsNumber: true })} />
                                {form.formState.errors.lines?.[index]?.quantity && (
                                  <p className="text-xs text-destructive mt-1">{form.formState.errors.lines[index]?.quantity?.message}</p>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <Input type="number" min={0} step="0.01" placeholder="0.00" className="text-right"
                                  {...form.register(`lines.${index}.rate`, { valueAsNumber: true })} />
                                {form.formState.errors.lines?.[index]?.rate && (
                                  <p className="text-xs text-destructive mt-1">{form.formState.errors.lines[index]?.rate?.message}</p>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <Input type="number" min={0} max={100} step="0.1" placeholder="0" className="text-right"
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
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-3">
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => append({ stockItemId: '', quantity: 0, rate: 0, discountPct: 0 })}
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
                      <Input type="number" step="0.01" min="0" placeholder="0"
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
                  <Button type="button" variant="outline" className="w-full min-h-[44px]"
                    onClick={() => router.back()}>
                    Cancel
                  </Button>
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
