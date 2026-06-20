'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, type Resolver, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ItemPickerDialog } from '@/components/item-picker-dialog'
import { createPurchaseAction } from '@/app/actions/create-purchase'

const lineSchema = z.object({
  stockItemId: z.string().uuid('Select a stock item'),
  quantity: z.number().positive('Enter quantity'),
  rate: z.number().positive('Enter rate'),
})

const schema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  advancePaid: z.number().min(0).default(0),
  currencyCode: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.number().positive().default(1),
  lines: z.array(lineSchema).min(1, 'Add at least one item'),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD', path: ['exchangeRate'] },
)

type FormValues = z.infer<typeof schema>

type Props = {
  today: string
  suppliers: { id: string; name: string }[]
  lots: { id: string; name: string; count: string }[]
}

export function CreatePurchaseForm({ today, suppliers, lots }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const supplierPickerItems = suppliers.map((s) => ({ id: s.id, name: s.name }))
  const lotPickerItems = lots.map((l) => ({ id: l.id, name: l.name, badge: l.count }))

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      supplierId: '', date: today, advancePaid: 0,
      currencyCode: 'PKR', exchangeRate: 1,
      lines: [{ stockItemId: '', quantity: 0, rate: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })

  const watchedCurrency = form.watch('currencyCode')
  const watchedExchangeRate = form.watch('exchangeRate')
  const watchedLines = form.watch('lines')

  const er = watchedCurrency === 'USD' ? (watchedExchangeRate || 1) : 1
  const totalPkr = watchedLines.reduce((sum, l) => sum + (l.quantity || 0) * (l.rate || 0) * er, 0)

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      for (let i = 0; i < values.lines.length; i++) {
        const line = values.lines[i]
        const result = await createPurchaseAction({
          supplierId: values.supplierId,
          stockItemId: line.stockItemId,
          quantity: line.quantity,
          rate: line.rate,
          currencyCode: values.currencyCode,
          exchangeRate: values.exchangeRate,
          date: values.date,
          advancePaid: i === 0 ? values.advancePaid : 0,
        })
        if (!result.success) { setServerError(`Line ${i + 1}: ${result.error}`); return }
      }
      router.push('/purchases')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* Header */}
        <Card>
          <CardHeader className="pb-4 pt-5 px-5">
            <CardTitle className="text-base">Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 grid gap-4 sm:grid-cols-2">
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
                    disabled={suppliers.length === 0}
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

            <FormField control={form.control} name="advancePaid" render={() => (
              <FormItem>
                <FormLabel>Advance Paid (PKR)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" placeholder="0" {...form.register('advancePaid', { valueAsNumber: true })} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

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
            <CardTitle className="text-base">Items</CardTitle>
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
                                    disabled={lots.length === 0}
                                  />
                                  {fieldState.error && <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>}
                                </div>
                              )}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input type="number" min={0} step="0.001" placeholder="0"
                              {...form.register(`lines.${index}.quantity`, { valueAsNumber: true })} />
                            {form.formState.errors.lines?.[index]?.quantity && (
                              <p className="text-xs text-destructive mt-1">{form.formState.errors.lines[index]?.quantity?.message}</p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Input type="number" min={0} step="0.01" placeholder="0.00"
                              {...form.register(`lines.${index}.rate`, { valueAsNumber: true })} />
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
          </CardContent>
        </Card>

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1 min-h-[44px]" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" className="flex-1 min-h-[44px] bg-green-600 hover:bg-green-700 text-white"
            disabled={isPending || suppliers.length === 0 || lots.length === 0}>
            {isPending ? 'Saving…' : `Confirm Purchase${fields.length > 1 ? ` (${fields.length} items)` : ''}`}
          </Button>
        </div>
        {(suppliers.length === 0 || lots.length === 0) && (
          <p className="text-xs text-muted-foreground text-center">
            {suppliers.length === 0 ? 'Add a supplier first.' : 'Add a stock item first.'}
          </p>
        )}
      </form>
    </Form>
  )
}
