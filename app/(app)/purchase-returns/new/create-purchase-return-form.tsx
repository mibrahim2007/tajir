'use client'

import { useRef, useState, useTransition, useMemo } from 'react'
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
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ItemPickerDialog, type PickerItem } from '@/components/item-picker-dialog'
import { QuickCreateSupplier } from '@/components/quick-create-forms'
import { createPurchaseReturnAction } from '@/app/actions/create-purchase-return'
import { FileUploader, type FileUploaderHandle } from '@/components/file-uploader'

const lineSchema = z.object({
  stockItemId: z.string().uuid('Select a stock item'),
  quantity:    z.number().positive('Enter quantity'),
  rate:        z.number().positive('Enter rate'),
  discountPct: z.number().min(0).max(100).default(0),
})

const schema = z.object({
  purchaseOrderId: z.string().optional(),
  supplierId:      z.string().min(1, 'Supplier is required'),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  reason:          z.string().optional(),
  currencyCode:    z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:    z.number().positive().default(1),
  locationId:      z.string().optional(),
  lines:           z.array(lineSchema).min(1, 'Add at least one item'),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD', path: ['exchangeRate'] },
)

type FormValues = z.infer<typeof schema>

type PurchaseOrder = { id: string; date: string; supplierId: string; stockItemId: string; quantity: string; rate: string; currencyCode: string }

type Props = {
  today:          string
  suppliers:      { id: string; name: string }[]
  lots:           { id: string; name: string; count: string }[]
  purchaseOrders: PurchaseOrder[]
  locations:      { id: string; name: string }[]
}

export function CreatePurchaseReturnForm({ today, suppliers, lots, purchaseOrders, locations }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const uploaderRef = useRef<FileUploaderHandle>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      purchaseOrderId: '', supplierId: '', date: today, reason: '',
      currencyCode: 'PKR', exchangeRate: 1, locationId: '',
      lines: [{ stockItemId: '', quantity: NaN, rate: NaN, discountPct: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })

  const watchedCurrency     = form.watch('currencyCode')
  const watchedExchangeRate = form.watch('exchangeRate')
  const watchedLines        = form.watch('lines')
  const selectedPoId        = form.watch('purchaseOrderId')

  const er = watchedCurrency === 'USD' ? (watchedExchangeRate || 1) : 1

  const { subtotal, discountTotal, netTotal } = useMemo(() => {
    const sub  = watchedLines.reduce((s, l) => s + (l.quantity || 0) * (l.rate || 0) * er, 0)
    const disc = watchedLines.reduce((s, l) => s + (l.quantity || 0) * (l.rate || 0) * er * ((l.discountPct || 0) / 100), 0)
    return { subtotal: sub, discountTotal: disc, netTotal: sub - disc }
  }, [watchedLines, er])

  const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 0 })

  const handlePoSelect = (poId: string) => {
    form.setValue('purchaseOrderId', poId)
    const po = purchaseOrders.find((o) => o.id === poId)
    if (po) {
      form.setValue('supplierId', po.supplierId)
      form.setValue('currencyCode', po.currencyCode as 'PKR' | 'USD')
      const lines = form.getValues('lines')
      if (lines.length === 1 && !lines[0].stockItemId) {
        form.setValue('lines.0.stockItemId', po.stockItemId)
        form.setValue('lines.0.rate', parseFloat(po.rate))
      }
    }
  }

  const [supplierList, setSupplierList] = useState<PickerItem[]>(
    suppliers.map((s) => ({ id: s.id, name: s.name }))
  )
  const supplierPickerItems = supplierList
  const lotPickerItems = lots.map((l) => ({ id: l.id, name: l.name, badge: l.count }))

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      let firstEntryId: string | null = null
      for (let i = 0; i < values.lines.length; i++) {
        const line = values.lines[i]
        const effectiveRate = line.rate * (1 - (line.discountPct || 0) / 100)
        const result = await createPurchaseReturnAction({
          supplierId:      values.supplierId,
          stockItemId:     line.stockItemId,
          quantity:        line.quantity,
          rate:            effectiveRate,
          currencyCode:    values.currencyCode,
          exchangeRate:    values.exchangeRate,
          date:            values.date,
          purchaseOrderId: i === 0 ? values.purchaseOrderId || undefined : undefined,
          reason:          values.reason || undefined,
          locationId:      values.locationId || undefined,
        })
        if (!result.success) { setServerError(`Line ${i + 1}: ${result.error}`); return }
        if (i === 0) firstEntryId = result.data.id
      }
      if (firstEntryId) await uploaderRef.current?.uploadFiles(firstEntryId, 'purchase_return')
      router.push('/purchase-returns')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-5">

            {/* Header card */}
            <Card>
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-base">Return Details</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 grid gap-4 sm:grid-cols-2">
                <FormItem className="sm:col-span-2">
                  <FormLabel>Against Purchase Order (optional)</FormLabel>
                  <Select onValueChange={handlePoSelect} value={selectedPoId}>
                    <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select purchase order…" /></SelectTrigger>
                    <SelectContent>
                      {purchaseOrders.map((o) => {
                        const supplier = suppliers.find((s) => s.id === o.supplierId)
                        const lot = lots.find((l) => l.id === o.stockItemId)
                        return (
                          <SelectItem key={o.id} value={o.id}>
                            {o.date} — {supplier?.name ?? '?'} — {lot?.name ?? '?'} ({o.quantity} units)
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </FormItem>

                <FormField control={form.control} name="supplierId" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
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
                    <FormLabel>Return Date <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="reason" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl><Input placeholder="e.g. Defective, wrong item…" {...field} className="min-h-[44px]" /></FormControl>
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
                          <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select location (optional)…" /></SelectTrigger>
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
                <CardTitle className="text-base">Return Items</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-8">#</th>
                          <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Item</th>
                          <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-32">Qty</th>
                          <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-28">Rate</th>
                          <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-20">Disc %</th>
                          <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-32">Amount</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {fields.map((field, index) => {
                          const line   = watchedLines[index] ?? {}
                          const amount = (line.quantity || 0) * (line.rate || 0) * er * (1 - (line.discountPct || 0) / 100)
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
                                      />
                                      {fieldState.error && <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>}
                                    </div>
                                  )}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <NumericInput min={0} step="0.001" placeholder="" className="text-right"
                                  {...form.register(`lines.${index}.quantity`, { valueAsNumber: true })} />
                                {form.formState.errors.lines?.[index]?.quantity && (
                                  <p className="text-xs text-destructive mt-1">{form.formState.errors.lines[index]?.quantity?.message}</p>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <NumericInput min={0} step="0.01" placeholder="" className="text-right"
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
                {form.formState.errors.lines?.message && (
                  <p className="text-xs text-destructive mt-2">{form.formState.errors.lines.message as string}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT COLUMN — sticky summary ── */}
          <div className="lg:sticky lg:top-6 space-y-4">
            <Card>
              <CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Return Summary</p>

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

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px] bg-green-600 hover:bg-green-700 text-white"
                    disabled={isPending}>
                    {isPending ? 'Saving…' : `Confirm Return${fields.length > 1 ? ` (${fields.length} items)` : ''}`}
                  </Button>
                  <ExitButton
                    isDirty={form.formState.isDirty}
                    onExit={() => router.back()}
                    className="w-full min-h-[44px]"
                  />
                </div>

                {serverError && <p className="text-sm text-destructive mt-3">{serverError}</p>}

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
