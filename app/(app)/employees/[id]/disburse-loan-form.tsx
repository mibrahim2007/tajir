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
import { TenderLinesField, type TenderLine, type EndorsableCheque } from '@/components/tender-lines-field'
import { createEmployeeLoanAction } from '@/app/actions/create-employee-loan'
import { generateSchedule } from '@/lib/loans/amortization'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'

type Bank = { id: string; name: string; account_number: string | null }
type EmployeeOption = { id: string; name: string }


const schema = z.object({
  employeeId:       z.string().optional().default(''),
  currencyCode:     z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:     z.number().positive().default(1),
  disbursementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  installmentCount: z.preprocess((v) => (v === '' || v === null || v === undefined ? 0 : v), z.coerce.number().int().min(0)).default(0),
  firstDueDate:     z.string().optional(),
  notes:            z.string().optional(),
  lines:            z.array(tenderLineFormSchema).min(1, 'Add at least one tender line'),
}).refine((v) => v.lines.some((l) => (Number(l.amount) || 0) > 0), {
  message: 'Enter a positive amount for at least one tender line',
  path: ['lines'],
}).refine((v) => !(v.installmentCount > 0) || !!v.firstDueDate, {
  message: 'Set a first due date for the installment schedule',
  path: ['firstDueDate'],
})

type FormValues = z.infer<typeof schema>

const emptyLine: TenderLine = { transactionType: 'cash', chequeNumber: '', chequeDueDate: '', bankId: '', amount: 0 }
const freshDefaults = (today: string): FormValues => ({
  employeeId: '', currencyCode: 'PKR', exchangeRate: 1, disbursementDate: today, installmentCount: 0, firstDueDate: '', notes: '', lines: [{ ...emptyLine }],
})

// Full-page form. Two modes: fixed employee at /employees/[id]/loan (from an
// employee ledger) or an employee picker at /loans/new (from the Loans page —
// pass `employees`, omit `employeeId`). `returnPath` is the page it came from.
export function DisburseLoanForm({ employeeId, employees, today, nextSerial, banks = [], endorsableCheques = [], returnPath }: { employeeId?: string; employees?: EmployeeOption[]; today: string; nextSerial?: string | null; banks?: Bank[]; endorsableCheques?: EndorsableCheque[]; returnPath: string }) {
  const showPicker = !employeeId && !!employees
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: freshDefaults(today),
  })

  const watchedCurrency = form.watch('currencyCode')
  const watchedLines = form.watch('lines') ?? []
  const watchedCount = Number(form.watch('installmentCount')) || 0
  const watchedFirstDue = form.watch('firstDueDate')
  const principal = watchedLines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const watchedEmployeeId = form.watch('employeeId')
  const watchedDate = form.watch('disbursementDate')
  const employeeName = showPicker ? employees!.find((e) => e.id === watchedEmployeeId)?.name : undefined
  const fmtAmount = (n: number) => (watchedCurrency !== 'PKR' ? `${watchedCurrency} ${n.toLocaleString()}` : formatPKR(n))

  const preview = watchedCount > 0 && watchedFirstDue && principal > 0
    ? generateSchedule({ principal, installmentCount: watchedCount, firstDueDate: watchedFirstDue })
    : []

  const onSubmit = (values: FormValues) => {
    const empId = employeeId ?? values.employeeId
    if (!empId) { setServerError('Select an employee'); return }
    startTransition(async () => {
      setServerError(null)
      const result = await createEmployeeLoanAction({
        employeeId: empId,
        currencyCode: values.currencyCode,
        exchangeRate: values.exchangeRate,
        disbursementDate: values.disbursementDate,
        installmentCount: values.installmentCount || undefined,
        firstDueDate: values.installmentCount > 0 ? values.firstDueDate : undefined,
        notes: values.notes,
        lines: values.lines.filter((l) => (Number(l.amount) || 0) > 0).map((l) => ({
          transactionType: l.transactionType,
          chequeNumber: l.chequeNumber || undefined,
          chequeDueDate: l.chequeDueDate || undefined,
          bankId: l.bankId || undefined,
          amount: l.amount,
          endorsedFromSource: l.endorsedFromSource || undefined,
          endorsedFromLineId: l.endorsedFromLineId || undefined,
        })),
      })
      if (!result.success) { setServerError(result.error); return }
      // Back to where the form was opened from. No router.refresh() inside
      // the transition — it keeps isPending stuck.
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
              <CardTitle className="text-base">Loan Details</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                {showPicker && (
                  <FormField control={form.control} name="employeeId" render={({ field }) => (
                    <FormItem className="md:col-span-12">
                      <FormLabel>Employee <span className="text-destructive">*</span></FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="Select an employee…" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {employees!.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                {nextSerial && (
                  <div className="space-y-2 md:col-span-4">
                    <label className="text-sm font-medium leading-none">Serial No.</label>
                    <Input value={nextSerial} disabled readOnly className="min-h-[44px] font-mono" />
                    <p className="text-xs text-muted-foreground">Auto-generated on save.</p>
                  </div>
                )}

                <FormField control={form.control} name="disbursementDate" render={({ field }) => (
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
                      <FormControl><SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger></FormControl>
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

              <TenderLinesField banks={banks} currency={watchedCurrency} endorsableCheques={endorsableCheques} layout="wide" />

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <FormField control={form.control} name="installmentCount" render={({ field }) => (
                  <FormItem className="md:col-span-4">
                    <FormLabel>Installments</FormLabel>
                    <FormControl><Input type="number" step="1" min="0" placeholder="0 = ad-hoc" className="min-h-[44px]" {...field} onChange={(e) => field.onChange(e.target.value === '' ? 0 : e.target.valueAsNumber)} /></FormControl>
                    <p className="text-xs text-muted-foreground">Leave 0 for open / ad-hoc repayment.</p>
                    <FormMessage />
                  </FormItem>
                )} />
                {watchedCount > 0 && (
                  <FormField control={form.control} name="firstDueDate" render={({ field }) => (
                    <FormItem className="md:col-span-4">
                      <FormLabel>First Due Date <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>

              {preview.length > 0 && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Schedule preview</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-x-8 gap-y-0.5 max-h-60 overflow-y-auto tabular-nums">
                    {preview.map((s) => (
                      <li key={s.installmentNo} className="flex justify-between">
                        <span className="text-muted-foreground">#{s.installmentNo} · {formatPKTDate(new Date(s.dueDate))}</span>
                        <span>{watchedCurrency !== 'PKR' ? `${watchedCurrency} ${s.amount.toLocaleString()}` : formatPKR(s.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (optional)</FormLabel>
                  <FormControl><Input placeholder="e.g. Advance against salary…" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── SUMMARY (right on xl, sticky) ── */}
          <div className="xl:sticky xl:top-6">
            <Card><CardContent className="px-5 pt-5 pb-5">
              <p className="font-extrabold text-[15px] tracking-tight mb-4">Loan Summary</p>

              <div className="space-y-2 text-sm">
                {showPicker && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Employee</span>
                    <span className="font-medium text-right">{employeeName ?? '—'}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Date</span>
                  <span className="font-medium tabular-nums">{watchedDate || '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Currency</span>
                  <span className="font-medium">{watchedCurrency}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Installments</span>
                  <span className="font-medium tabular-nums">{watchedCount > 0 ? watchedCount : 'Ad-hoc'}</span>
                </div>
                {watchedCount > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">First Due</span>
                    <span className="font-medium tabular-nums">{watchedFirstDue || '—'}</span>
                  </div>
                )}
                {preview.length > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Per Installment</span>
                    <span className="font-medium tabular-nums">{fmtAmount(preview[0].amount)}</span>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between items-center gap-2 mb-5">
                <span className="font-bold text-sm">Amount</span>
                <span className="text-lg font-extrabold tabular-nums tracking-tight text-right">{fmtAmount(principal)}</span>
              </div>

              <div className="space-y-2">
                <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                  {isPending ? 'Saving…' : 'Disburse Loan'}
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
