'use client'

import { useState, useTransition, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ExitButton } from '@/components/exit-button'
import { useForm, useFieldArray, type Resolver, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Barcode, X, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { NumericInput } from '@/components/numeric-input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ItemPickerDialog, type PickerItem } from '@/components/item-picker-dialog'
import { QuickCreateCustomer } from '@/components/quick-create-forms'
import { FileUploader, type FileUploaderHandle } from '@/components/file-uploader'
import { createSaleInvoiceAction } from '@/app/actions/create-sale-invoice'

type Customer    = { id: string; name: string }
type StockItem   = { id: string; name: string; currentQuantity: string; barcode: string | null }
type PricingRule = { customerId: string; stockItemId: string; rate: string }
type LocationStock = { stockItemId: string; locationId: string; quantity: number }

const lineSchema = z.object({
  stockItemId: z.string().uuid('Select a stock item'),
  quantity:    z.number().positive('Enter quantity'),
  rate:        z.number().positive('Enter rate'),
  discountPct: z.number().min(0).max(100).default(0),
})

const baseSchema = z.object({
  customerId:      z.string().uuid('Select a customer'),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentDueDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  notes:           z.string().optional(),
  currencyCode:    z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:    z.number().positive().default(1),
  locationId:      z.string().optional(),
  lines:           z.array(lineSchema).min(1, 'Add at least one item'),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD', path: ['exchangeRate'] },
)

type FormValues   = z.infer<typeof baseSchema>
type OversellError = { lineIndex: number; itemName: string; available: number; requested: number }

export function CreateSaleForm({ today, customers, stockItems, pricingRules, isOwner, locations, locationStock, costMap }: {
  today: string
  customers:    Customer[]
  stockItems:   StockItem[]
  pricingRules: PricingRule[]
  isOwner:      boolean
  locations:    { id: string; name: string }[]
  locationStock: LocationStock[]
  costMap:      Record<string, number>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError]   = useState<string | null>(null)
  const [oversellErrors, setOversellErrors] = useState<OversellError[]>([])
  const [pendingValues, setPendingValues]   = useState<FormValues | null>(null)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeError, setBarcodeError] = useState<string | null>(null)
  const barcodeRef  = useRef<HTMLInputElement>(null)
  const uploaderRef = useRef<FileUploaderHandle>(null)

  const requireLocation = locations.length > 0

  // Local state so newly created items appear immediately
  const [customerList, setCustomerList] = useState<PickerItem[]>(
    customers.map((c) => ({ id: c.id, name: c.name }))
  )
  const formSchema = useMemo(
    () => requireLocation
      ? baseSchema.refine(d => !!d.locationId, { message: 'Select a location', path: ['locationId'] })
      : baseSchema,
    [requireLocation],
  )

  const customerPickerItems = customerList

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      customerId: '', date: today, paymentDueDate: '', notes: '',
      currencyCode: 'PKR', exchangeRate: 1, locationId: '',
      lines: [{ stockItemId: '', quantity: NaN, rate: NaN, discountPct: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })

  const watchedCustomer     = form.watch('customerId')
  const watchedCurrency     = form.watch('currencyCode')
  const watchedExchangeRate = form.watch('exchangeRate')
  const watchedLines        = form.watch('lines')
  const watchedLocation     = form.watch('locationId')

  const er = watchedCurrency === 'USD' ? (watchedExchangeRate || 1) : 1

  const { subtotal, discountTotal, netTotal } = useMemo(() => {
    const sub  = watchedLines.reduce((s, l) => s + (l.quantity || 0) * (l.rate || 0) * er, 0)
    const disc = watchedLines.reduce((s, l) => s + (l.quantity || 0) * (l.rate || 0) * er * ((l.discountPct || 0) / 100), 0)
    return { subtotal: sub, discountTotal: disc, netTotal: sub - disc }
  }, [watchedLines, er])

  const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 0 })

  const locStockMap = useMemo<Record<string, number> | null>(() => {
    if (!watchedLocation) return null
    const map: Record<string, number> = {}
    locationStock.filter(ls => ls.locationId === watchedLocation)
      .forEach(ls => { map[ls.stockItemId] = ls.quantity })
    return map
  }, [watchedLocation, locationStock])

  const stockPickerItems = useMemo(() => {
    return stockItems
      .filter(s => {
        if (!locStockMap) return true
        return (locStockMap[s.id] ?? 0) > 0
      })
      .map(s => ({
        id: s.id,
        name: s.name,
        meta: locStockMap
          ? `${(locStockMap[s.id] ?? 0).toLocaleString()} avail.`
          : `${parseFloat(s.currentQuantity).toLocaleString()} avail.`,
      }))
  }, [stockItems, locStockMap])

  const getPricedRate = (customerId: string, stockItemId: string) => {
    const rule = pricingRules.find((r) => r.customerId === customerId && r.stockItemId === stockItemId)
    return rule ? parseFloat(rule.rate) : null
  }

  const handleBarcodeScan = useCallback((code: string) => {
    const trimmed = code.trim()
    if (!trimmed) return
    const match = stockItems.find((s) => s.barcode && s.barcode.trim() === trimmed)
    if (!match) { setBarcodeError(`No item found for barcode "${trimmed}"`); return }
    setBarcodeError(null)
    setBarcodeInput('')
    const lines = form.getValues('lines')
    const emptyIdx = lines.findIndex((l) => !l.stockItemId)
    const rate = getPricedRate(form.getValues('customerId'), match.id) ?? 0
    if (emptyIdx >= 0) {
      form.setValue(`lines.${emptyIdx}.stockItemId`, match.id)
      if (rate) form.setValue(`lines.${emptyIdx}.rate`, rate)
    } else {
      append({ stockItemId: match.id, quantity: 0, rate, discountPct: 0 })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockItems, pricingRules, append])

  const runSubmit = (values: FormValues, allowOversell: boolean) => {
    startTransition(async () => {
      setServerError(null)

      const result = await createSaleInvoiceAction({
        customerId:     values.customerId,
        date:           values.date,
        paymentDueDate: values.paymentDueDate || undefined,
        currencyCode:   values.currencyCode,
        exchangeRate:   values.exchangeRate,
        locationId:     values.locationId || undefined,
        notes:          values.notes,
        allowOversell,
        lines: values.lines.map((l) => ({
          stockItemId: l.stockItemId,
          quantity:    l.quantity,
          rate:        l.rate,
          discountPct: l.discountPct,
        })),
      })

      if (!result.success) {
        if (result.code === 'OVERSELL' && 'oversells' in result) {
          const newOversells: OversellError[] = result.oversells.map((o) => {
            const lineIndex = values.lines.findIndex((l) => l.stockItemId === o.stockItemId)
            const item = stockItems.find((s) => s.id === o.stockItemId)
            return { lineIndex: lineIndex >= 0 ? lineIndex : 0, itemName: item?.name ?? o.stockItemId, available: o.available, requested: o.requested }
          })
          setPendingValues(values)
          setOversellErrors(newOversells)
          return
        }
        if ('error' in result) { setServerError(result.error); return }
      } else {
        await uploaderRef.current?.uploadFiles(result.data.invoiceId, 'sale_order')
        router.push('/sales')
      }
    })
  }

  const onSubmit = (values: FormValues) => runSubmit(values, false)

  const confirmOversell = () => {
    if (!pendingValues) return
    setOversellErrors([])
    setPendingValues(null)
    runSubmit(pendingValues, true)
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-5">

              {/* Header card */}
              <Card>
                <CardHeader className="pb-3 pt-5 px-5">
                  <CardTitle className="text-base">Sale Details</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="customerId" render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Customer <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <ItemPickerDialog
                          items={customerPickerItems}
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

                  <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sale Date <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="paymentDueDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Due</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {locations.length > 0 && (
                    <FormField control={form.control} name="locationId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dispatch From <span className="text-destructive">*</span></FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select location…" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Line Items</CardTitle>
                    <div className="relative w-48">
                      <Barcode className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                      <input
                        ref={barcodeRef}
                        type="text"
                        value={barcodeInput}
                        onChange={(e) => { setBarcodeInput(e.target.value); setBarcodeError(null) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleBarcodeScan(barcodeInput) } }}
                        placeholder="Scan barcode…"
                        autoComplete="off"
                        className="h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-7 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      {barcodeInput && (
                        <button type="button" onClick={() => { setBarcodeInput(''); setBarcodeError(null); barcodeRef.current?.focus() }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {barcodeError && <p className="text-xs text-destructive mt-1">{barcodeError}</p>}
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  {requireLocation && !watchedLocation && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">Select a location above to see available stock.</p>
                  )}
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
                            const line      = watchedLines[index] ?? {}
                            const amount    = (line.quantity || 0) * (line.rate || 0) * er * (1 - (line.discountPct || 0) / 100)
                            const item      = stockItems.find((s) => s.id === line.stockItemId)
                            const cost      = line.stockItemId ? costMap[line.stockItemId] : undefined
                            const ratePKR   = (line.rate || 0) * er
                            const belowCost = cost !== undefined && line.rate > 0 && ratePKR < cost
                            const avail  = item
                              ? (locStockMap ? (locStockMap[item.id] ?? 0) : parseFloat(item.currentQuantity))
                              : null

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
                                          items={stockPickerItems}
                                          value={f.value}
                                          onSelect={(v) => {
                                            f.onChange(v)
                                            const r = getPricedRate(watchedCustomer, v)
                                            if (r) form.setValue(`lines.${index}.rate`, r)
                                          }}
                                          placeholder="Select item…"
                                          title="Select Stock Item"
                                        />
                                        {fieldState.error && <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>}
                                        {avail !== null && (
                                          <p className="text-xs text-muted-foreground mt-0.5">
                                            Avail{locStockMap ? ' at location' : ''}: {avail.toLocaleString()}
                                          </p>
                                        )}
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
                                  <NumericInput min={0} step="0.01" placeholder="" className={`text-right ${belowCost ? 'border-amber-400 focus-visible:ring-amber-400' : ''}`}
                                    {...form.register(`lines.${index}.rate`, { valueAsNumber: true })} />
                                  {form.formState.errors.lines?.[index]?.rate && (
                                    <p className="text-xs text-destructive mt-1">{form.formState.errors.lines[index]?.rate?.message}</p>
                                  )}
                                  {belowCost && (
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-0.5">
                                      <AlertTriangle className="h-3 w-3 shrink-0" />
                                      Below cost (Rs {Math.round(cost!).toLocaleString()})
                                    </p>
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

              {/* Notes */}
              <Card>
                <CardContent className="px-5 py-4">
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Delivery instructions, payment terms, or any remarks…" rows={3} {...field} />
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
                  <p className="font-extrabold text-[15px] tracking-tight mb-4">Sale Summary</p>

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
                      {isPending ? 'Saving…' : `Confirm Sale${fields.length > 1 ? ` (${fields.length} items)` : ''}`}
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

      {/* Oversell dialog */}
      <Dialog open={oversellErrors.length > 0} onOpenChange={() => { setOversellErrors([]); setPendingValues(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Insufficient Stock</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            {oversellErrors.map((e) => (
              <div key={e.lineIndex} className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                <p className="font-medium">Line {e.lineIndex + 1}: {e.itemName}</p>
                <p className="text-muted-foreground">
                  Available: {e.available.toLocaleString()} · Requested: {e.requested.toLocaleString()} · Shortfall: {(e.requested - e.available).toLocaleString()}
                </p>
              </div>
            ))}
            {isOwner
              ? <p className="text-sm text-muted-foreground pt-1">As owner, you can override this. Inventory will go negative.</p>
              : <p className="text-sm text-muted-foreground pt-1">Please reduce the quantity or ask the owner to proceed.</p>
            }
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOversellErrors([]); setPendingValues(null) }}>Cancel</Button>
            {isOwner && <Button variant="destructive" onClick={confirmOversell}>Override &amp; Confirm</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
