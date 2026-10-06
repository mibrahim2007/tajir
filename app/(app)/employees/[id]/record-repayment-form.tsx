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
import { recordLoanRepaymentAction } from '@/app/actions/record-loan-repayment'
import { formatPKR } from '@/lib/utils/currency'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'
import { todayPKT } from '@/lib/utils/dates'

type Bank = { id: string; name: string; account_number: string | null }
type LoanOption = { id: string; label: string }

const AUTO = '__auto__'


const schema = z.object({
  loanId: z.string().default(AUTO),
  currencyCode: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.number().positive().default(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentMethodNote: z.string().optional(),
  lines: z.array(tenderLineFormSchema).min(1, 'Add at least one tender line'),
}).refine((v) => v.lines.some((l) => (Number(l.amount) || 0) > 0), {
  message: 'Enter a positive amount for at least one tender line',
  path: ['lines'],
})

type FormValues = z.infer<typeof schema>

const emptyLine: TenderLine = { transactionType: 'cash', chequeNumber: '', chequeDueDate: '', bankId: '', amount: 0 }
const freshDefaults = (today: string): FormValues => ({
  loanId: AUTO, currencyCode: 'PKR', exchangeRate: 1, date: today, paymentMethodNote: '', lines: [{ ...emptyLine }],
})

// Full-page form at /employees/[id]/repayment (was a drawer on the employee
// ledger, which it returns to).
export function RecordRepaymentForm({ employeeId, today, nextSerial, banks = [], loans = [] }: { employeeId: string; today: string; nextSerial?: string | null; banks?: Bank[]; loans?: LoanOption[] }) {
  const router = useRouter()
  const returnPath = `/employees/${employeeId}/ledger`
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: freshDefaults(today),
  })

  const watchedCurrency = form.watch('currencyCode')
  const watchedDate = form.watch('date')
  const watchedLoanId = form.watch('loanId')
  const watchedLines = form.watch('lines') ?? []
  const total = watchedLines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const loanLabel = watchedLoanId === AUTO ? 'Auto (oldest first)' : (loans.find((l) => l.id === watchedLoanId)?.label ?? '—')
  const fmtAmount = (n: number) => (watchedCurrency !== 'PKR' ? `${watchedCurrency} ${n.toLocaleString()}` : formatPKR(n))

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await recordLoanRepaymentAction({
        employeeId,
        loanId: values.loanId === AUTO ? undefined : values.loanId,
        currencyCode: values.currencyCode,
        exchangeRate: values.exchangeRate,
        date: values.date,
        paymentMethodNote: values.paymentMethodNote,
        lines: values.lines.filter((l) => (Number(l.amount) || 0) > 0).map((l) => ({
          transactionType: l.transactionType,
          chequeNumber: l.chequeNumber || undefined,
          chequeDueDate: l.chequeDueDate || undefined,
          bankId: l.bankId || undefined,
          amount: l.amount,
        })),
      })
      if (!result.success) { setServerError(result.error); return }
      // Back to the ledger. No router.refresh() inside the transition — it
      // keeps isPending stuck.
      router.push(returnPath)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, () => setServerError('Please complete the highlighted fields and enter a positive amount.'))} onKeyDown={handleEnterToNext}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

          {/* ── FORM (left on xl) ── */}
          <Card className="min-w-0">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base">Repayment Details</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
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
                    <FormControl><Input type="date" max={todayPKT()} className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="currencyCode" render={({ field }) => (
                  <FormItem className={nextSerial ? 'md:col-span-4' : 'md:col-span-6'}>
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

                {loans.length > 0 && (
                  <FormField control={form.control} name="loanId" render={({ field }) => (
                    <FormItem className="md:col-span-6">
                      <FormLabel>Apply to loan</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value={AUTO}>Auto (oldest first)</SelectItem>
                          {loans.map((l) => (
                            <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                )}

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

              <TenderLinesField banks={banks} currency={watchedCurrency} layout="wide" />

              <FormField control={form.control} name="paymentMethodNote" render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (optional)</FormLabel>
                  <FormControl><Input placeholder="e.g. March installment…" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── SUMMARY (right on xl, sticky) ── */}
          <div className="xl:sticky xl:top-6">
            <Card><CardContent className="px-5 pt-5 pb-5">
              <p className="font-extrabold text-[15px] tracking-tight mb-4">Repayment Summary</p>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Date</span>
                  <span className="font-medium tabular-nums">{watchedDate || '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Currency</span>
                  <span className="font-medium">{watchedCurrency}</span>
                </div>
                {loans.length > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Apply to</span>
                    <span className="font-medium text-right text-xs leading-5">{loanLabel}</span>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between items-center gap-2 mb-5">
                <span className="font-bold text-sm">Amount</span>
                <span className="text-lg font-extrabold tabular-nums tracking-tight text-right">{fmtAmount(total)}</span>
              </div>

              <div className="space-y-2">
                <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                  {isPending ? 'Saving…' : 'Record Repayment'}
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
