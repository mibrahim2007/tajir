'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { tenderLineFormSchema } from '@/lib/constants/tender-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { TenderLinesField, type TenderLine } from '@/components/tender-lines-field'
import { createCustomerRefundAction } from '@/app/actions/create-customer-refund'
import { formatPKR } from '@/lib/utils/currency'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'

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

export function RefundCustomerForm({ customerId, today, creditAmount, nextSerial, banks = [] }: {
  customerId:   string
  today:        string
  creditAmount: number
  nextSerial?:  string | null
  banks?:       Bank[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

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
      form.reset(freshDefaults(today))
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="min-h-[44px] border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40">
          Issue Refund
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto w-full sm:max-w-5xl">
        <SheetHeader>
          <SheetTitle>Issue Customer Refund</SheetTitle>
          <SheetDescription>
            Pay back PKR {creditAmount.toLocaleString('en-PK', { maximumFractionDigits: 0 })} credit to this customer.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, () => setServerError('Please complete the highlighted fields and enter a positive amount.'))} onKeyDown={handleEnterToNext} className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px] gap-5 items-start">
            <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {nextSerial && (
                <div className="space-y-2 md:col-span-4">
                  <label className="text-sm font-medium leading-none">Serial No.</label>
                  <Input value={nextSerial} disabled readOnly className="min-h-[44px] font-mono" />
                  <p className="text-xs text-muted-foreground">Auto-generated on save.</p>
                </div>
              )}
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem className={nextSerial ? 'md:col-span-4' : 'md:col-span-6'}>
                  <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="currencyCode" render={({ field }) => (
                <FormItem className={nextSerial ? 'md:col-span-4' : 'md:col-span-6'}>
                  <FormLabel>Currency</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="PKR">PKR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              {watchedCurrency === 'USD' && (
                <FormField control={form.control} name="exchangeRate" render={({ field }) => (
                  <FormItem className="md:col-span-6">
                    <FormLabel>Exchange Rate (PKR per USD) <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="number" step="0.01" min="1" className="min-h-[44px]" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} /></FormControl>
                  </FormItem>
                )} />
              )}
            </div>

            <Separator />

            <TenderLinesField banks={banks} currency={watchedCurrency} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (optional)</FormLabel>
                <FormControl><Input placeholder="e.g. Refund for SR-0012…" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            </div>

            {/* ── Summary — after the fields in source order, shown on the right on wide screens ── */}
            <div className="md:sticky md:top-0">
              <Card><CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Refund Summary</p>

                <div className="space-y-2 text-sm">
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

                <Button type="submit" className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isPending}>
                  {isPending ? 'Processing…' : 'Confirm Refund'}
                </Button>
                {serverError && <p className="text-sm text-destructive mt-3">{serverError}</p>}
              </CardContent></Card>
            </div>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
