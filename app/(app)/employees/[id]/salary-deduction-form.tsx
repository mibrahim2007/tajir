'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { recordSalaryDeductionAction } from '@/app/actions/record-salary-deduction'
import { formatPKR } from '@/lib/utils/currency'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'

type LoanOption = { id: string; label: string }

const AUTO = '__auto__'

const schema = z.object({
  loanId: z.string().default(AUTO),
  amount: z.number().positive('Enter a positive amount'),
  date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  note:   z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const freshDefaults = (today: string): FormValues => ({ loanId: AUTO, amount: 0, date: today, note: '' })

export function SalaryDeductionForm({ employeeId, today, monthlySalary = 0, loans = [] }: { employeeId: string; today: string; monthlySalary?: number; loans?: LoanOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: freshDefaults(today),
  })

  const watchedDate = form.watch('date')
  const watchedAmount = Number(form.watch('amount')) || 0
  const watchedLoanId = form.watch('loanId')
  const loanLabel = watchedLoanId === AUTO ? 'Auto (oldest first)' : (loans.find((l) => l.id === watchedLoanId)?.label ?? '—')
  const hasLoans = loans.length > 0

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await recordSalaryDeductionAction({
        employeeId,
        loanId: values.loanId === AUTO ? undefined : values.loanId,
        amount: values.amount,
        date: values.date,
        note: values.note,
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
        <Button variant="outline" className="min-h-[44px]">Salary Deduction</Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto w-full sm:max-w-5xl">
        <SheetHeader>
          <SheetTitle>Recover via Salary Deduction</SheetTitle>
          <SheetDescription>Withhold part of this month&apos;s salary against the loan. No cash moves — it posts Salaries &amp; Wages against the loan balance.</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext} className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px] gap-5 items-start">
            <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem className={hasLoans ? 'md:col-span-4' : 'md:col-span-6'}>
                  <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem className={hasLoans ? 'md:col-span-4' : 'md:col-span-6'}>
                  <FormLabel>Amount (PKR) <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" className="min-h-[44px]" placeholder="0.00" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber || 0)} /></FormControl>
                  {monthlySalary > 0 && <p className="text-xs text-muted-foreground">Monthly salary: {formatPKR(monthlySalary)}</p>}
                  <FormMessage />
                </FormItem>
              )} />

              {loans.length > 0 && (
                <FormField control={form.control} name="loanId" render={({ field }) => (
                  <FormItem className="md:col-span-4">
                    <FormLabel>Apply to loan</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger></FormControl>
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
            </div>

            <FormField control={form.control} name="note" render={({ field }) => (
              <FormItem>
                <FormLabel>Note (optional)</FormLabel>
                <FormControl><Input placeholder="e.g. March payroll" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            </div>

            {/* ── Summary — after the fields in source order, shown on the right on wide screens ── */}
            <div className="md:sticky md:top-0">
              <Card><CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Deduction Summary</p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Date</span>
                    <span className="font-medium tabular-nums">{watchedDate || '—'}</span>
                  </div>
                  {hasLoans && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Loan</span>
                      <span className="font-medium text-right">{loanLabel}</span>
                    </div>
                  )}
                  {monthlySalary > 0 && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Monthly Salary</span>
                      <span className="font-medium tabular-nums">{formatPKR(monthlySalary)}</span>
                    </div>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between items-center gap-2 mb-5">
                  <span className="font-bold text-sm">Deduction</span>
                  <span className="text-lg font-extrabold tabular-nums tracking-tight text-right">{formatPKR(watchedAmount)}</span>
                </div>

                <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                  {isPending ? 'Saving…' : 'Record Deduction'}
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
