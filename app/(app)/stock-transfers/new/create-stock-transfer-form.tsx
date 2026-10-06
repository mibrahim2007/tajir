'use client'

import { useState, useTransition, useMemo } from 'react'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ItemPickerDialog } from '@/components/item-picker-dialog'
import { NumericInput } from '@/components/numeric-input'
import { createStockTransferAction } from '@/app/actions/create-stock-transfer'

const schema = z.object({
  fromLocationId: z.string().uuid('Select from-location'),
  toLocationId:   z.string().uuid('Select to-location'),
  stockItemId:    z.string().uuid('Select stock item'),
  quantity:       z.number().positive('Quantity must be positive'),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  notes:          z.string().max(500).optional(),
}).refine(
  (d) => d.fromLocationId !== d.toLocationId,
  { message: 'From and To must be different', path: ['toLocationId'] },
)

type FormValues = z.infer<typeof schema>

type LocationStock = { stockItemId: string; locationId: string; quantity: number }

type Props = {
  today: string
  locations: { id: string; name: string }[]
  items: { id: string; name: string; count: string }[]
  locationStock: LocationStock[]
}

export function CreateStockTransferForm({ today, locations, items, locationStock }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fromLocationId: '', toLocationId: '', stockItemId: '',
      quantity: NaN, date: today, notes: '',
    },
  })

  const watchedFrom = form.watch('fromLocationId')
  const watchedItem = form.watch('stockItemId')
  const watchedTo   = form.watch('toLocationId')
  const watchedDate = form.watch('date')
  const watchedQty  = form.watch('quantity')

  const fromName = locations.find(l => l.id === watchedFrom)?.name
  const toName   = locations.find(l => l.id === watchedTo)?.name
  const itemName = items.find(i => i.id === watchedItem)?.name

  // Stock at the selected from-location
  const fromLocMap = useMemo<Record<string, number>>(() => {
    if (!watchedFrom) return {}
    const map: Record<string, number> = {}
    locationStock
      .filter(ls => ls.locationId === watchedFrom)
      .forEach(ls => { map[ls.stockItemId] = ls.quantity })
    return map
  }, [watchedFrom, locationStock])

  const availableQty = watchedItem ? (fromLocMap[watchedItem] ?? 0) : null

  // Filter items to those with stock at from-location; show their available qty
  const itemPickerItems = useMemo(() => {
    const filtered = watchedFrom
      ? items.filter(i => (fromLocMap[i.id] ?? 0) > 0)
      : items
    return filtered.map(i => ({
      id: i.id,
      name: i.name,
      badge: i.count,
      meta: watchedFrom ? `${(fromLocMap[i.id] ?? 0).toLocaleString()} avail.` : undefined,
    }))
  }, [watchedFrom, items, fromLocMap])

  // When from-location changes, clear stockItemId if no longer available there;
  // also clear toLocationId if it matches the new from-location
  const handleFromChange = (v: string) => {
    form.setValue('fromLocationId', v)
    const currentItem = form.getValues('stockItemId')
    if (currentItem) {
      const newMap: Record<string, number> = {}
      locationStock.filter(ls => ls.locationId === v).forEach(ls => { newMap[ls.stockItemId] = ls.quantity })
      if ((newMap[currentItem] ?? 0) <= 0) form.setValue('stockItemId', '')
    }
    if (form.getValues('toLocationId') === v) form.setValue('toLocationId', '')
  }

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createStockTransferAction(values)
      if (!result.success) { setServerError(result.error); return }
      router.push('/stock-transfers')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
        <Card>
          <CardHeader className="pb-4 pt-5 px-5">
            <CardTitle className="text-base">Transfer Details</CardTitle>
          </CardHeader>
          {/* Date · From · To, then Stock Item · Quantity share rows on wide screens. */}
          <CardContent className="px-5 pb-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem className="md:col-span-4">
                <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="fromLocationId" render={({ field }) => (
              <FormItem className="md:col-span-4">
                <FormLabel>From Location <span className="text-destructive">*</span></FormLabel>
                <Select value={field.value} onValueChange={handleFromChange}>
                  <FormControl>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="Select location…" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="toLocationId" render={({ field }) => (
              <FormItem className="md:col-span-4">
                <FormLabel>To Location <span className="text-destructive">*</span></FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="Select location…" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {locations.filter(l => l.id !== watchedFrom).map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="stockItemId" render={({ field }) => (
              <FormItem className="md:col-span-9">
                <FormLabel>Stock Item <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <ItemPickerDialog
                    items={itemPickerItems}
                    value={field.value}
                    onSelect={field.onChange}
                    placeholder={watchedFrom ? 'Select item with stock at this location…' : 'Select from-location first…'}
                    title="Select Stock Item"
                  />
                </FormControl>
                {availableQty !== null && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Available at from-location: <span className="font-medium">{availableQty.toLocaleString()}</span>
                  </p>
                )}
                {watchedFrom && itemPickerItems.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">No stock at selected location.</p>
                )}
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="quantity" render={() => (
              <FormItem className="md:col-span-3">
                <FormLabel>Quantity <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <NumericInput min={0.001} step="0.001" placeholder=""
                    {...form.register('quantity', { valueAsNumber: true })} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea placeholder="Optional notes…" rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        {/* ── Summary — after the form in source order, shown on the right on wide screens ── */}
        <div className=" xl:sticky xl:top-6">
          <Card>
            <CardContent className="px-5 pt-5 pb-5">
              <p className="font-extrabold text-[15px] tracking-tight mb-4">Transfer Summary</p>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Date</span>
                  <span className="font-medium tabular-nums">{watchedDate || '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">From</span>
                  <span className="font-medium text-right">{fromName ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">To</span>
                  <span className="font-medium text-right">{toName ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Stock Item</span>
                  <span className="font-medium text-right text-xs leading-5">{itemName ?? '—'}</span>
                </div>
                {availableQty !== null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Available</span>
                    <span className="font-medium tabular-nums">{availableQty.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between items-center mb-5">
                <span className="font-bold text-sm">Quantity</span>
                <span className="text-xl font-extrabold tabular-nums tracking-tight">
                  {Number.isFinite(watchedQty) && watchedQty > 0 ? watchedQty.toLocaleString() : '—'}
                </span>
              </div>

              <div className="space-y-2">
                <Button type="submit" className="w-full min-h-[44px]" disabled={isPending || locations.length < 2}>
                  {isPending ? 'Saving…' : 'Confirm Transfer'}
                </Button>
                <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.back()}>Cancel</Button>
              </div>
              {locations.length < 2 && (
                <p className="text-xs text-muted-foreground text-center mt-2">Add at least 2 locations first.</p>
              )}

              {serverError && <p className="text-sm text-destructive mt-3">{serverError}</p>}
            </CardContent>
          </Card>
        </div>
        </div>
      </form>
    </Form>
  )
}
