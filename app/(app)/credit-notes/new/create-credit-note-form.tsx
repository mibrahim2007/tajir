'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ItemPickerDialog } from '@/components/item-picker-dialog'
import { NumericInput } from '@/components/numeric-input'
import { ExitButton } from '@/components/exit-button'
import { createCreditNoteAction } from '@/app/actions/create-credit-note'

const schema = z.object({
  customerId:   z.string().min(1, 'Customer is required'),
  saleOrderId:  z.string().optional(),
  amount:       z.number().positive('Amount must be positive'),
  currencyCode: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.number().positive().default(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  reason:       z.string().optional(),
  reference:    z.string().optional(),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD', path: ['exchangeRate'] },
)

type FormValues = z.infer<typeof schema>

type SaleOrder = { id: string; date: string; customerId: string; pkrEquivalent: number; currencyCode: string }

type Props = {
  today:      string
  customers:  { id: string; name: string }[]
  saleOrders: SaleOrder[]
}

export function CreateCreditNoteForm({ today, customers, saleOrders }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      customerId: '', saleOrderId: '', amount: NaN,
      currencyCode: 'PKR', exchangeRate: 1,
      date: today, reason: '', reference: '',
    },
  })

  const watchedCurrency     = form.watch('currencyCode')
  const watchedExchangeRate = form.watch('exchangeRate')
  const watchedAmount       = form.watch('amount')
  const watchedCustomerId   = form.watch('customerId')

  const er = watchedCurrency === 'USD' ? (watchedExchangeRate || 1) : 1
  const pkrTotal = (watchedAmount || 0) * er

  const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 0 })

  const filteredOrders = saleOrders.filter((o) => !watchedCustomerId || o.customerId === watchedCustomerId)

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createCreditNoteAction({
        ...values,
        saleOrderId: values.saleOrderId || undefined,
        reason:      values.reason || undefined,
        reference:   values.reference || undefined,
      })
      if (!result.success) { setServerError(result.error); return }
      router.push('/credit-notes')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-base">Credit Note Details</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 grid gap-4 sm:grid-cols-2">

                <FormField control={form.control} name="customerId" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Customer <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <ItemPickerDialog
                        items={customers.map((c) => ({ id: c.id, name: c.name }))}
                        value={field.value}
                        onSelect={(v) => { field.onChange(v); form.setValue('saleOrderId', '') }}
                        placeholder="Select customer…"
                        title="Select Customer"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormItem className="sm:col-span-2">
                  <FormLabel>Against Sale Order (optional)</FormLabel>
                  <Select
                    value={form.watch('saleOrderId') || '_none_'}
                    onValueChange={(v) => {
                      const val = v === '_none_' ? '' : v
                      form.setValue('saleOrderId', val)
                      if (val) {
                        const so = saleOrders.find((o) => o.id === val)
                        if (so) {
                          form.setValue('customerId', so.customerId)
                          form.setValue('currencyCode', so.currencyCode as 'PKR' | 'USD')
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="No sale order" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">No sale order</SelectItem>
                      {filteredOrders.map((o) => {
                        const customer = customers.find((c) => c.id === o.customerId)
                        return (
                          <SelectItem key={o.id} value={o.id}>
                            {o.date} — {customer?.name ?? '?'} — Rs {o.pkrEquivalent.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </FormItem>

                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="reference" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. invoice no., CN-001…" className="min-h-[44px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="reason" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Price adjustment, quality deduction, shortage allowance…" className="min-h-[44px]" {...field} />
                    </FormControl>
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

                <FormField control={form.control} name="amount" render={() => (
                  <FormItem>
                    <FormLabel>Amount ({watchedCurrency}) <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <NumericInput
                        min={0} step="0.01" placeholder="0.00"
                        {...form.register('amount', { valueAsNumber: true })}
                      />
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
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Summary</p>

                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 mb-4 text-xs text-blue-700 dark:text-blue-300">
                  <p className="font-semibold mb-1">Credit Note — Customer Adjustment</p>
                  <p>Reduces what the customer owes you. Posts:</p>
                  <p className="mt-1 font-mono">DR Sales Returns & Allowances</p>
                  <p className="font-mono">CR Accounts Receivable</p>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount ({watchedCurrency})</span>
                    <span className="tabular-nums font-medium">{watchedCurrency} {(watchedAmount || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {watchedCurrency === 'USD' && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Exchange Rate</span>
                      <span className="tabular-nums font-medium">1 USD = {er} PKR</span>
                    </div>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between items-center mb-5">
                  <span className="font-bold text-sm">PKR Total</span>
                  <span className="text-xl font-extrabold tabular-nums tracking-tight">Rs {fmt(pkrTotal)}</span>
                </div>

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={isPending}>
                    {isPending ? 'Saving…' : 'Post Credit Note'}
                  </Button>
                  <ExitButton
                    isDirty={form.formState.isDirty}
                    onExit={() => router.back()}
                    className="w-full min-h-[44px]"
                  />
                </div>

                {serverError && <p className="text-sm text-destructive mt-3">{serverError}</p>}
              </CardContent>
            </Card>
          </div>

        </div>
      </form>
    </Form>
  )
}
