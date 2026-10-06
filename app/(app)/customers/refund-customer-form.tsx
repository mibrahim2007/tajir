'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { tenderLineFormSchema } from '@/lib/constants/tender-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { TenderLinesField, type TenderLine } from '@/components/tender-lines-field'
import { createCustomerRefundAction } from '@/app/actions/create-customer-refund'
import { formatPKR } from '@/lib/utils/currency'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'
import { todayPKT } from '@/lib/utils/dates'

type Bank = { id: string; name: string; account_number: string | null }


const schema = z.object({
  currencyCode: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.number().positive().default(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  notes: z.string().optional(),
  lines: z.array(tenderLineFormSchema).min(1, 'Add at least one tender line'),
}).refine((v) => v.lines.some((l) => (Number(l.amount) || 0) > 0), {
  message: 'Enter a positive amount for at least one tender line',
  path: ['lines'],
})

type FormValues = z.infer<typeof schema>

const emptyLine: TenderLine = { transactionType: 'cash', chequeNumber: '', chequeDueDate: '', bankId: '', amount: 0 }
const freshDefaults = (today: string): FormValues => ({
  currencyCode: 'PKR', exchangeRate: 1, date: today, notes: '', lines: [{ ...emptyLine }],
})

// Full-page form at /customers/[id]/refund (was a drawer on the customer ledger).
export function RefundCustomerForm({ customerId, customerName, today, creditAmount, nextSerial, banks = [] }: {
  customerId:   string
  customerName: string
  today:        string
  creditAmount: number
  nextSerial?:  string | null
  banks?:       Bank[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()
  const returnPath = `/customers/${customerId}/ledger`

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: freshDefaults(today),
  })

  const watchedCurrency = form.watch('currencyCode')
  const watchedDate = form.watch('date')
  const watchedRate = Number(form.watch('exchangeRate')) || 0
  const watchedLines = form.watch('lines') ?? []
  const lineTotal = watchedLines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const totalPKR = watchedCurrency === 'USD' ? lineTotal * watchedRate : lineTotal

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createCustomerRefundAction({
        customerId,
        currencyCode: values.currencyCode,
        exchangeRate: values.exchangeRate,
        date: values.date,
        notes: values.notes,
        lines: values.lines.filter((l) => (Number(l.amount) || 0) > 0).map((l) => ({
          transactionType: l.transactionType,
          chequeNumber: l.chequeNumber || undefined,
          chequeDueDate: l.chequeDueDate || undefined,
          bankId: l.bankId || undefined,
          amount: l.amount,
        })),
      })
      if (!result.success) { setServerError(result.error); return }
      // Back to the ledger. Do NOT call router.refresh() after push — inside a
      // transition that keeps isPending true forever, hanging the Save button.
      router.push(returnPath)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, () => setServerError('Please complete the highlighted fields and enter a positive amount.'))} onKeyDown={handleEnterToNext}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

          {/* ── LEFT COLUMN ── */}
          <Card>
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base">Refund Details</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">

              {/* Serial · Customer · Date · Currency share one row on wide screens. */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                {nextSerial && (
                  <div className="space-y-2 md:col-span-3">
                    <label className="text-sm font-medium leading-none">Serial No.</label>
                    <Input value={nextSerial} disabled readOnly className="min-h-[44px] font-mono" />
                    <p className="text-xs text-muted-foreground">Auto-generated on save.</p>
                  </div>
                )}
                <div className={`space-y-2 ${nextSerial ? 'md:col-span-5' : 'md:col-span-8'}`}>
                  <label className="text-sm font-medium leading-none">Customer</label>
                  <Input value={customerName} disabled readOnly className="min-h-[44px]" />
                </div>
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="date" max={todayPKT()} className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="currencyCode" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Currency</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="PKR">PKR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>

              {watchedCurrency === 'USD' && (
                <FormField control={form.control} name="exchangeRate" render={({ field }) => (
                  <FormItem className="md:max-w-xs">
                    <FormLabel>Exchange Rate (PKR per USD) <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="number" step="0.01" min="1" className="min-h-[44px]" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} /></FormControl>
                  </FormItem>
                )} />
              )}

              <Separator />

              <TenderLinesField banks={banks} currency={watchedCurrency} layout="wide" />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl><Input placeholder="e.g. Refund for SR-0012…" className="min-h-[44px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── SUMMARY (right on xl, sticky) ── */}
          <div className="xl:sticky xl:top-6">
            <Card><CardContent className="px-5 pt-5 pb-5">
              <p className="font-extrabold text-[15px] tracking-tight mb-4">Refund Summary</p>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Customer</span>
                  <span className="font-medium text-right truncate">{customerName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Credit Available</span>
                  <span className="font-medium tabular-nums">{formatPKR(creditAmount)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Date</span>
                  <span className="font-medium tabular-nums">{watchedDate || '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Currency</span>
                  <span className="font-medium">{watchedCurrency}</span>
                </div>
                {watchedCurrency === 'USD' && (
                  <>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Rate</span>
                      <span className="font-medium tabular-nums">{watchedRate.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Amount (USD)</span>
                      <span className="font-medium tabular-nums">USD {lineTotal.toLocaleString()}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Tender Lines</span>
                  <span className="font-medium tabular-nums">{watchedLines.length}</span>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between items-center gap-2 mb-5">
                <span className="font-bold text-sm">Refund Total</span>
                <span className="text-lg font-extrabold tabular-nums tracking-tight text-right">{formatPKR(totalPKR)}</span>
              </div>

              <div className="space-y-2">
                <Button type="submit" className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isPending}>
                  {isPending ? 'Processing…' : 'Confirm Refund'}
                </Button>
                <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.push(returnPath)}>
                  Cancel
                </Button>
              </div>
              {serverError && <p className="text-sm text-destructive mt-3">{serverError}</p>}
            </CardContent></Card>
          </div>

        </div>
      </form>
    </Form>
  )
}
