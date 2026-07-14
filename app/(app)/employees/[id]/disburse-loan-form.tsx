'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { TenderLinesField, type TenderLine } from '@/components/tender-lines-field'
import { createEmployeeLoanAction } from '@/app/actions/create-employee-loan'
import { generateSchedule } from '@/lib/loans/amortization'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'

type Bank = { id: string; name: string; account_number: string | null }
type EmployeeOption = { id: string; name: string }

const lineSchema = z.object({
  transactionType: z.enum(['cash', 'pdc', 'online']),
  chequeNumber:    z.string().optional().default(''),
  bankId:          z.string().optional().default(''),
  amount:          z.preprocess(
    (v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? 0 : v),
    z.coerce.number().min(0),
  ),
})

const schema = z.object({
  employeeId:       z.string().optional().default(''),
  currencyCode:     z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:     z.number().positive().default(1),
  disbursementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  installmentCount: z.preprocess((v) => (v === '' || v === null || v === undefined ? 0 : v), z.coerce.number().int().min(0)).default(0),
  firstDueDate:     z.string().optional(),
  notes:            z.string().optional(),
  lines:            z.array(lineSchema).min(1, 'Add at least one tender line'),
}).refine((v) => v.lines.some((l) => (Number(l.amount) || 0) > 0), {
  message: 'Enter a positive amount for at least one tender line',
  path: ['lines'],
}).refine((v) => !(v.installmentCount > 0) || !!v.firstDueDate, {
  message: 'Set a first due date for the installment schedule',
  path: ['firstDueDate'],
})

type FormValues = z.infer<typeof schema>

const emptyLine: TenderLine = { transactionType: 'cash', chequeNumber: '', bankId: '', amount: 0 }
const freshDefaults = (today: string): FormValues => ({
  employeeId: '', currencyCode: 'PKR', exchangeRate: 1, disbursementDate: today, installmentCount: 0, firstDueDate: '', notes: '', lines: [{ ...emptyLine }],
})

// Two modes: fixed employee (from an employee ledger) or an employee picker
// (from the Loans page — pass `employees`, omit `employeeId`).
export function DisburseLoanForm({ employeeId, employees, today, nextSerial, banks = [] }: { employeeId?: string; employees?: EmployeeOption[]; today: string; nextSerial?: string | null; banks?: Bank[] }) {
  const showPicker = !employeeId && !!employees
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
  const watchedLines = form.watch('lines') ?? []
  const watchedCount = Number(form.watch('installmentCount')) || 0
  const watchedFirstDue = form.watch('firstDueDate')
  const principal = watchedLines.reduce((s, l) => s + (Number(l.amount) || 0), 0)

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
        <Button className="min-h-[44px]">Disburse Loan</Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Disburse Loan / Advance</SheetTitle>
          <SheetDescription>Pay a loan or advance{showPicker ? ' to an employee' : ' to this employee'}. Interest-free.</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, () => setServerError('Please complete the highlighted fields and enter a positive amount.'))} onKeyDown={handleEnterToNext} className="flex flex-col gap-4 mt-6">
            {showPicker && (
              <FormField control={form.control} name="employeeId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee <span className="text-destructive">*</span></FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select an employee…" /></SelectTrigger></FormControl>
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
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Serial No.</label>
                <Input value={nextSerial} disabled readOnly className="min-h-[44px] font-mono" />
                <p className="text-xs text-muted-foreground">Auto-generated on save.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="disbursementDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="currencyCode" render={({ field }) => (
                <FormItem>
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
            </div>

            {watchedCurrency === 'USD' && (
              <FormField control={form.control} name="exchangeRate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Exchange Rate (PKR per USD) <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="number" step="0.01" min="1" className="min-h-[44px]" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} /></FormControl>
                </FormItem>
              )} />
            )}

            <Separator />

            <TenderLinesField banks={banks} currency={watchedCurrency} />

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="installmentCount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Installments</FormLabel>
                  <FormControl><Input type="number" step="1" min="0" placeholder="0 = ad-hoc" className="min-h-[44px]" {...field} onChange={(e) => field.onChange(e.target.value === '' ? 0 : e.target.valueAsNumber)} /></FormControl>
                  <p className="text-xs text-muted-foreground">Leave 0 for open / ad-hoc repayment.</p>
                  <FormMessage />
                </FormItem>
              )} />
              {watchedCount > 0 && (
                <FormField control={form.control} name="firstDueDate" render={({ field }) => (
                  <FormItem>
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
                <ul className="space-y-0.5 max-h-40 overflow-y-auto tabular-nums">
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

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
              {isPending ? 'Saving…' : 'Disburse Loan'}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
