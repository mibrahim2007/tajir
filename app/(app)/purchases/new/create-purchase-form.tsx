'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/currency-input'
import { ItemPickerDialog } from '@/components/item-picker-dialog'
import { createPurchaseAction } from '@/app/actions/create-purchase'

const schema = z.object({
  supplierId:   z.string().min(1, 'Supplier is required'),
  stockItemId:  z.string().min(1, 'Stock item is required'),
  quantity:     z.number().positive('Quantity must be positive'),
  rate:         z.number().positive('Rate must be positive'),
  currencyCode: z.enum(['PKR', 'USD']),
  exchangeRate: z.number().positive().default(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  advancePaid:  z.number().min(0).default(0),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD transactions', path: ['exchangeRate'] },
)

type FormValues = z.infer<typeof schema>

type Props = {
  suppliers: { id: string; name: string }[]
  lots: { id: string; name: string; count: string }[]
}

export function CreatePurchaseForm({ suppliers, lots }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [supplierSearch, setSupplierSearch] = useState('')

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase())
  )

  const lotPickerItems = lots.map((l) => ({
    id: l.id,
    name: l.name,
    badge: l.count,
  }))

  const today = new Date().toISOString().split('T')[0]

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      supplierId: '', stockItemId: '', quantity: 0, rate: 0,
      currencyCode: 'PKR', exchangeRate: 1, date: today, advancePaid: 0,
    },
  })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createPurchaseAction(values)
      if (!result.success) { setServerError(result.error); return }
      router.push('/purchases')
    })
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">

            {/* Supplier — searchable dropdown */}
            <FormField control={form.control} name="supplierId" render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier <span className="text-destructive">*</span></FormLabel>
                <Select onValueChange={field.onChange} value={field.value}
                  onOpenChange={(open) => { if (!open) setSupplierSearch('') }}>
                  <FormControl>
                    <SelectTrigger className="w-full min-h-[44px]">
                      <SelectValue placeholder="Select supplier…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <div className="flex items-center gap-2 px-2 py-1.5 border-b">
                      <Search className="size-3.5 text-muted-foreground shrink-0" />
                      <input
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="Search suppliers…"
                        value={supplierSearch}
                        onChange={(e) => setSupplierSearch(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    {filteredSuppliers.length === 0 && (
                      <p className="py-4 text-center text-sm text-muted-foreground">No suppliers found</p>
                    )}
                    {filteredSuppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Stock Item — popup dialog picker */}
            <FormField control={form.control} name="stockItemId" render={({ field }) => (
              <FormItem>
                <FormLabel>Stock Item <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <ItemPickerDialog
                    items={lotPickerItems}
                    value={field.value}
                    onSelect={field.onChange}
                    placeholder="Select stock item…"
                    title="Select Stock Item"
                    disabled={lots.length === 0}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="quantity" render={() => (
              <FormItem>
                <FormLabel>Quantity <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="number" step="0.001" min="0" {...form.register('quantity', { valueAsNumber: true })} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <CurrencyInput
              amountName="rate"
              currencyName="currencyCode"
              exchangeRateName="exchangeRate"
              label="Rate per Unit"
              required
            />

            <FormField control={form.control} name="advancePaid" render={() => (
              <FormItem>
                <FormLabel>Advance Paid (PKR)</FormLabel>
                <FormControl><Input type="number" step="0.01" min="0" placeholder="0" {...form.register('advancePaid', { valueAsNumber: true })} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 min-h-[44px]" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 min-h-[44px]" disabled={isPending || suppliers.length === 0 || lots.length === 0}>
                {isPending ? 'Saving…' : 'Confirm Purchase'}
              </Button>
            </div>

            {(suppliers.length === 0 || lots.length === 0) && (
              <p className="text-xs text-muted-foreground text-center">
                {suppliers.length === 0 ? 'Add a supplier first.' : 'Add a stock item first.'}
              </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
