'use client'

import { useState, useTransition, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, type Resolver, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Barcode, X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ItemPickerDialog } from '@/components/item-picker-dialog'
import { createSaleOrderAction } from '@/app/actions/create-sale-order'

type Customer = { id: string; name: string }
type StockItem = { id: string; name: string; currentQuantity: string; barcode: string | null }
type PricingRule = { customerId: string; stockItemId: string; rate: string }

const lineSchema = z.object({
  stockItemId: z.string().uuid('Select a stock item'),
  quantity: z.number().positive('Enter quantity'),
  rate: z.number().positive('Enter rate'),
})

const schema = z.object({
  customerId: z.string().uuid('Select a customer'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  currencyCode: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.number().positive().default(1),
  locationId: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'Add at least one item'),
})

type FormValues = z.infer<typeof schema>
type OversellError = { lineIndex: number; itemName: string; available: number; requested: number }

export function CreateSaleForm({ today, customers, stockItems, pricingRules, isOwner, locations }: {
  today: string
  customers: Customer[]
  stockItems: StockItem[]
  pricingRules: PricingRule[]
  isOwner: boolean
  locations: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [oversellErrors, setOversellErrors] = useState<OversellError[]>([])
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeError, setBarcodeError] = useState<string | null>(null)
  const barcodeRef = useRef<HTMLInputElement>(null)

  const customerPickerItems = customers.map((c) => ({ id: c.id, name: c.name }))
  const stockPickerItems = stockItems.map((s) => ({
    id: s.id,
    name: s.name,
    meta: `${parseFloat(s.currentQuantity).toLocaleString()} avail.`,
  }))

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      customerId: '',
      date: today,
      paymentDueDate: '',
      currencyCode: 'PKR',
      exchangeRate: 1,
      locationId: '',
      lines: [{ stockItemId: '', quantity: 0, rate: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })

  const watchedCustomer = form.watch('customerId')
  const watchedCurrency = form.watch('currencyCode')
  const watchedExchangeRate = form.watch('exchangeRate')
  const watchedLines = form.watch('lines')

  const er = watchedCurrency === 'USD' ? (watchedExchangeRate || 1) : 1
  const totalPkr = watchedLines.reduce((sum, l) => sum + (l.quantity || 0) * (l.rate || 0) * er, 0)

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
      append({ stockItemId: match.id, quantity: 0, rate })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockItems, pricingRules, append])

  const runSubmit = (values: FormValues, allowOversell: boolean) => {
    startTransition(async () => {
      setServerError(null)
      const newOversells: OversellError[] = []

      for (let i = 0; i < values.lines.length; i++) {
        const line = values.lines[i]
        const result = await createSaleOrderAction({
          customerId: values.customerId,
          stockItemId: line.stockItemId,
          quantity: line.quantity,
          rate: line.rate,
          currencyCode: values.currencyCode,
          exchangeRate: values.exchangeRate,
          date: values.date,
          paymentDueDate: values.paymentDueDate || undefined,
          allowOversell,
          locationId: values.locationId || undefined,
        })

        if (!result.success) {
          if (result.code === 'OVERSELL' && 'available' in result) {
            const item = stockItems.find((s) => s.id === line.stockItemId)
            newOversells.push({ lineIndex: i, itemName: item?.name ?? `Item ${i + 1}`, available: result.available, requested: result.requested })
            continue
          }
          if ('error' in result) { setServerError(`Line ${i + 1}: ${result.error}`); return }
        }
      }

      if (newOversells.length > 0) {
        setPendingValues(values)
        setOversellErrors(newOversells)
        return
      }
      router.push('/sales')
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* Header */}
          <Card>
            <CardHeader className="pb-4 pt-5 px-5">
              <CardTitle className="text-base">Invoice Details</CardTitle>
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
                      disabled={customers.length === 0}
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
                  <FormLabel>Payment Due Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {locations.length > 0 && (
                <FormField control={form.control} name="locationId" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Location</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select location (optional)…" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No location</SelectItem>
                        {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              <div className="sm:col-span-2 flex gap-2 items-end">
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
                      <FormLabel>Exchange Rate (1 USD = ? PKR) <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="1" placeholder="e.g. 278.50" {...form.register('exchangeRate', { valueAsNumber: true })} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader className="pb-2 pt-5 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Items</CardTitle>
                {/* Barcode scanner */}
                <div className="relative w-52">
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
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-8">#</th>
                        <th className="text-left px-3 py-2.5 font-medium">Stock Item</th>
                        <th className="text-left px-3 py-2.5 font-medium w-28">Quantity</th>
                        <th className="text-left px-3 py-2.5 font-medium w-28">Rate</th>
                        <th className="text-right px-3 py-2.5 font-medium w-32">Amount (PKR)</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {fields.map((field, index) => {
                        const line = watchedLines[index] ?? {}
                        const lineAmount = (line.quantity || 0) * (line.rate || 0) * er
                        const item = stockItems.find((s) => s.id === line.stockItemId)
                        const avail = item ? parseFloat(item.currentQuantity) : null

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
                                      <p className="text-xs text-muted-foreground mt-0.5">Avail: {avail.toLocaleString()}</p>
                                    )}
                                  </div>
                                )}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number" min={0} step="0.001" placeholder="0"
                                {...form.register(`lines.${index}.quantity`, { valueAsNumber: true })}
                              />
                              {form.formState.errors.lines?.[index]?.quantity && (
                                <p className="text-xs text-destructive mt-1">{form.formState.errors.lines[index]?.quantity?.message}</p>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number" min={0} step="0.01" placeholder="0.00"
                                {...form.register(`lines.${index}.rate`, { valueAsNumber: true })}
                              />
                              {form.formState.errors.lines?.[index]?.rate && (
                                <p className="text-xs text-destructive mt-1">{form.formState.errors.lines[index]?.rate?.message}</p>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums pt-3">
                              {lineAmount > 0 ? lineAmount.toLocaleString('en-PK', { maximumFractionDigits: 0 }) : '—'}
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

              <div className="mt-3 flex items-center justify-between">
                <Button type="button" variant="outline" size="sm" onClick={() => append({ stockItemId: '', quantity: 0, rate: 0 })} className="gap-1.5">
                  <Plus className="size-4" /> Add Line
                </Button>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-0.5">Invoice Total</p>
                  <p className="text-lg font-semibold tabular-nums">
                    Rs {totalPkr.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                  </p>
                  {watchedCurrency === 'USD' && (
                    <p className="text-xs text-muted-foreground">PKR equivalent at {watchedExchangeRate}</p>
                  )}
                </div>
              </div>
              {form.formState.errors.lines?.message && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.lines.message as string}</p>
              )}
            </CardContent>
          </Card>

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1 min-h-[44px]" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" className="flex-1 min-h-[44px] bg-green-600 hover:bg-green-700 text-white" disabled={isPending}>
              {isPending ? 'Saving…' : `Confirm Sale${fields.length > 1 ? ` (${fields.length} items)` : ''}`}
            </Button>
          </div>
        </form>
      </Form>

      {/* Oversell dialog */}
      <Dialog open={oversellErrors.length > 0} onOpenChange={() => { setOversellErrors([]); setPendingValues(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insufficient Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {oversellErrors.map((e) => (
              <div key={e.lineIndex} className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                <p className="font-medium">Line {e.lineIndex + 1}: {e.itemName}</p>
                <p className="text-muted-foreground">
                  Available: {e.available.toLocaleString()} · Requested: {e.requested.toLocaleString()} · Shortfall: {(e.requested - e.available).toLocaleString()}
                </p>
              </div>
            ))}
            {isOwner ? (
              <p className="text-sm text-muted-foreground pt-1">As owner, you can override this. Inventory will go negative.</p>
            ) : (
              <p className="text-sm text-muted-foreground pt-1">Please reduce the quantity or ask the owner to proceed.</p>
            )}
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
