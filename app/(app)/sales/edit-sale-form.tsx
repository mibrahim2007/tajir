'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/currency-input'
import { editSaleAction } from '@/app/actions/edit-sale'

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

export function EditSaleForm({ sale, customers, lots, locations, costMap }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
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

  const save = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await editSaleAction({ id: sale.id, ...values })
      if (!result.success) { setError(result.error); return }
      setOpen(false)
      router.refresh()
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="min-h-[44px]"><Pencil className="h-4 w-4" /></Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>Edit Sale</SheetTitle></SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
            <FormField control={form.control} name="customerId" render={() => (
              <FormItem>
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
              <FormItem>
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

            <FormField control={form.control} name="quantity" render={({ field: { value } }) => {
              const uom = lots.find(l => l.id === watchedStockItemId)?.unitOfMeasure
              return (
                <FormItem>
                  <FormLabel>Quantity <span className="text-destructive">*</span>{uom && <span className="ml-1 text-muted-foreground font-normal">({uom})</span>}</FormLabel>
                  <FormControl><Input type="number" step="0.001" min="0" value={value} {...form.register('quantity', { valueAsNumber: true })} /></FormControl>
                  <FormMessage />
                </FormItem>
              )
            }} />

            <CurrencyInput
              amountName="rate"
              currencyName="currencyCode"
              exchangeRateName="exchangeRate"
              label="Rate per Unit"
              required
            />
            {belowCost && (
              <p className="text-xs text-amber-600 dark:text-amber-400 -mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Below purchase cost (Rs {Math.round(cost!).toLocaleString()})
              </p>
            )}

            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="paymentDueDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Due Date</FormLabel>
                <FormControl><Input type="date" className="min-h-[44px]" {...field} value={field.value ?? ''} /></FormControl>
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

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </form>
        </Form>
      </SheetContent>

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
    </Sheet>
  )
}
